import { createHash } from 'node:crypto';

const workflowTerms = new Set(['adjust', 'audio', 'caption', 'clip', 'edit', 'export', 'filter', 'split', 'text', 'timeline', 'trim']);
const browsingTerms = new Set(['comment', 'comments', 'following', 'for', 'like', 'reel', 'reels', 'share', 'subscribe', 'watch', 'you']);

export function words(value) {
  return String(value || '').toLowerCase().match(/[a-z0-9]+(?:'[a-z0-9]+)?/g) || [];
}

export function textSimilarity(left, right) {
  const a = new Set(words(left));
  const b = new Set(words(right));
  if (!a.size && !b.size) return 1;
  const overlap = [...a].filter(word => b.has(word)).length;
  return overlap / Math.max(a.size, b.size);
}

function closestSpeech(ocr, speech) {
  const candidates = speech.filter(span => ocr.start_seconds >= span.start_seconds - 0.75 && ocr.start_seconds <= span.end_seconds + 0.75);
  return candidates.sort((a, b) => textSimilarity(ocr.text, b.text) - textSimilarity(ocr.text, a.text))[0] || null;
}

export function classifyOcr(rawOcr, speechSpans) {
  const burnedInCaptions = [];
  const otherText = [];
  const conflicts = [];
  for (const observation of rawOcr) {
    const speech = closestSpeech(observation, speechSpans);
    const similarity = speech ? textSimilarity(observation.text, speech.text) : 0;
    const normalized = words(observation.text).join(' ');
    const spoken = words(speech?.text).join(' ');
    const centerY = observation.bounds ? observation.bounds.y + observation.bounds.height / 2 : null;
    const captionRegion = Number.isFinite(centerY) && centerY >= 0.35 && centerY <= 0.92;
    const captionCandidate = captionRegion && Boolean(speech) && (similarity >= 0.45 || words(observation.text).length >= 2);
    const classified = {
      ...observation,
      signal_type: captionCandidate ? 'burned_in_caption' : 'other_on_screen_text',
      classification: {
        method: 'layout_plus_temporal_asr_overlap_v1',
        confidence: captionCandidate && similarity >= 0.7 ? 'medium' : 'low',
        caption_region: captionRegion,
        related_spoken_span_id: speech?.observation_id || null,
        lexical_similarity_to_speech: Number(similarity.toFixed(4))
      },
      uncertainty: captionCandidate
        ? 'Caption classification is heuristic. OCR remains distinct from speech and does not correct ASR.'
        : 'Text was not classified as speech-aligned caption text; it remains on-screen text.'
    };
    (captionCandidate ? burnedInCaptions : otherText).push(classified);
    if (captionCandidate && speech && normalized && spoken && normalized !== spoken) {
      conflicts.push({
        conflict_id: `conflict-${conflicts.length + 1}`,
        type: 'spoken_caption_disagreement',
        start_seconds: Math.min(observation.start_seconds, speech.start_seconds),
        end_seconds: Math.max(observation.end_seconds, speech.end_seconds),
        spoken_observation_id: speech.observation_id,
        caption_observation_id: observation.observation_id,
        spoken_text: speech.text,
        caption_text: observation.text,
        lexical_similarity: Number(similarity.toFixed(4)),
        state: 'unresolved',
        resolution_rule: 'Preserve both modalities; do not silently select or rewrite either.'
      });
    }
  }
  return { burnedInCaptions, otherText, conflicts };
}

function pixelDifference(previous, current) {
  if (!previous) return 0;
  let total = 0;
  for (let index = 0; index < current.length; index++) total += Math.abs(current[index] - previous[index]) / 255;
  return total / current.length;
}

function translation(previous, current, baselineMagnitude) {
  if (!previous || baselineMagnitude < 0.025) return null;
  const score = (dx, dy) => {
    let total = 0;
    let count = 0;
    for (let y = 6; y < 58; y += 2) for (let x = 6; x < 58; x += 2) {
      total += Math.abs(current[y * 64 + x] - previous[(y - dy) * 64 + (x - dx)]);
      count++;
    }
    return total / count;
  };
  const baseline = score(0, 0);
  let best = { dx: 0, dy: 0, score: baseline };
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const candidate = score(dx, dy);
    if (candidate < best.score) best = { dx, dy, score: candidate };
  }
  if ((!best.dx && !best.dy) || best.score > baseline * 0.9) return null;
  const axis = Math.abs(best.dy) >= Math.abs(best.dx) ? 'vertical' : 'horizontal';
  const direction = axis === 'vertical' ? (best.dy > 0 ? 'down' : 'up') : (best.dx > 0 ? 'right' : 'left');
  return { axis, direction, dx: best.dx, dy: best.dy, magnitude: Number((Math.hypot(best.dx, best.dy) / 64).toFixed(4)) };
}

function activityForText(text) {
  const tokens = new Set(words(text));
  const workflowMatches = [...tokens].filter(token => workflowTerms.has(token));
  const browsingMatches = [...tokens].filter(token => browsingTerms.has(token));
  if (workflowMatches.length) return { state: 'editing_workflow_candidate', basis: 'ocr_keyword_heuristic', matched_terms: workflowMatches, confidence: 'low' };
  if (browsingMatches.length >= 2) return { state: 'unrelated_browsing_watching_candidate', basis: 'ocr_keyword_heuristic', matched_terms: browsingMatches, confidence: 'low' };
  return { state: 'indeterminate_activity', basis: 'insufficient_observable_evidence', matched_terms: [], confidence: 'unknown' };
}

export function buildSemanticVisualObservations(rawFrames, timestamps, ocr) {
  const observations = [];
  let previous = null;
  for (let index = 0; index < rawFrames.length; index++) {
    const pixels = rawFrames[index];
    const timestamp = timestamps[index];
    const difference = pixelDifference(previous, pixels);
    const movement = translation(previous, pixels, difference);
    const frameText = ocr.filter(item => Math.abs(item.start_seconds - timestamp) < 0.001).map(item => item.text).join(' ');
    const state = index === 0 ? 'initial_state' : difference < 0.025 ? 'sampled_stable_state' : movement ? `${movement.axis}_viewport_motion` : difference >= 0.16 ? 'major_visual_state_change' : 'visual_state_change';
    observations.push({
      observation_id: `visual-${String(index + 1).padStart(6, '0')}`,
      start_seconds: timestamp,
      end_seconds: timestamp,
      signal_type: 'sampled_visual_state',
      state,
      frame_fingerprint: createHash('sha256').update(pixels).digest('hex').slice(0, 20),
      difference_from_previous: Number(difference.toFixed(4)),
      motion: movement,
      visible_subjects: [],
      visible_objects: [],
      setting: null,
      observable_actions: movement ? [`viewport_motion_${movement.direction}`] : state.includes('change') ? ['visual_state_changed'] : [],
      ui_text_observation_ids: ocr.filter(item => Math.abs(item.start_seconds - timestamp) < 0.001).map(item => item.observation_id),
      activity: activityForText(frameText),
      verification_modality: 'sampled_64x64_grayscale_change_plus_ocr_heuristic',
      uncertainty: 'This is sampled screen-state evidence, not frame-exhaustive subject/object recognition. Empty subject/object fields mean not recovered, not absent.'
    });
    previous = pixels;
  }
  return observations;
}

export function buildSpeakerTurns(speechSpans) {
  return speechSpans.map((span, index) => ({
    observation_id: `turn-${String(index + 1).padStart(6, '0')}`,
    start_seconds: span.start_seconds,
    end_seconds: span.end_seconds,
    speaker_label: 'speaker_unknown',
    spoken_observation_id: span.observation_id,
    text: span.text,
    boundary_method: 'silence_bounded_asr_utterance',
    speaker_identity_state: 'not_determined',
    uncertainty: 'A turn boundary was recovered, but no voice-clustering diarization or identity evidence is available.'
  }));
}

export function buildSynchronizedTimeline(lanes, conflicts) {
  const timeline = [];
  for (const [lane, body] of Object.entries(lanes)) {
    for (const observation of body.observations || []) {
      timeline.push({
        event_id: `event-${String(timeline.length + 1).padStart(7, '0')}`,
        start_seconds: observation.start_seconds ?? observation.timestamp_seconds,
        end_seconds: observation.end_seconds ?? observation.start_seconds ?? observation.timestamp_seconds,
        lane,
        observation_id: observation.observation_id,
        signal_type: observation.signal_type || lane,
        verification_modality: body.verification_modality,
        source_refs: [observation.observation_id, observation.source_frame_id, observation.spoken_observation_id].filter(Boolean),
        uncertainty: observation.uncertainty || body.uncertainty || null
      });
    }
  }
  for (const conflict of conflicts) timeline.push({
    event_id: `event-${String(timeline.length + 1).padStart(7, '0')}`,
    start_seconds: conflict.start_seconds,
    end_seconds: conflict.end_seconds,
    lane: 'modality_conflict',
    observation_id: conflict.conflict_id,
    signal_type: conflict.type,
    verification_modality: 'cross_modal_comparison',
    source_refs: [conflict.spoken_observation_id, conflict.caption_observation_id],
    uncertainty: 'Conflict is intentionally unresolved.'
  });
  timeline.sort((a, b) => a.start_seconds - b.start_seconds || a.event_id.localeCompare(b.event_id));
  return timeline;
}

export function validateSynchronizedTimeline(evidence) {
  const known = new Set();
  for (const lane of Object.values(evidence.lanes || {})) for (const observation of lane.observations || []) {
    if (observation.observation_id) known.add(observation.observation_id);
  }
  for (const conflict of evidence.modality_conflicts || []) if (conflict.conflict_id) known.add(conflict.conflict_id);
  const ids = new Set();
  for (const event of evidence.synchronized_timeline || []) {
    if (!event.event_id || ids.has(event.event_id)) throw new Error('Timeline event IDs must be present and unique.');
    ids.add(event.event_id);
    if (!Number.isFinite(event.start_seconds) || !Number.isFinite(event.end_seconds) || event.end_seconds < event.start_seconds) throw new Error(`Invalid timeline bounds for ${event.event_id}.`);
    if (!known.has(event.observation_id)) throw new Error(`Timeline event ${event.event_id} references an unknown observation.`);
    if (!Array.isArray(event.source_refs)) throw new Error(`Timeline event ${event.event_id} is missing provenance refs.`);
  }
  return true;
}
