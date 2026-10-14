package mary_kate.enforcement

import rego.v1

default allow := false

allowed_action_types := {"none", "github_write"}

schema_violations contains "Policy input must be an object." if {
	not is_object(input)
}

schema_violations contains "claim_completion must be boolean." if {
	is_object(input)
	not is_boolean(object.get(input, "claim_completion", null))
}

schema_violations contains "action must be an object." if {
	is_object(input)
	not is_object(object.get(input, "action", null))
}

schema_violations contains "action.type is invalid." if {
	action := object.get(input, "action", null)
	is_object(action)
	not allowed_action_types[object.get(action, "type", null)]
}

schema_violations contains "Completion claims require required_checks and check_results." if {
	object.get(input, "claim_completion", false) == true
	not is_array(object.get(input, "required_checks", null))
}

schema_violations contains "Completion claims require required_checks and check_results." if {
	object.get(input, "claim_completion", false) == true
	not is_object(object.get(input, "check_results", null))
}

completion_violations contains concat("", ["Required check ", check, " did not pass."]) if {
	input.claim_completion
	some check in input.required_checks
	object.get(input.check_results, check, "missing") != "passed"
}

write_violations contains "GitHub write lacks explicit approval." if {
	input.action.type == "github_write"
	object.get(object.get(input, "authorization", {}), "approved", false) != true
}

write_violations contains "GitHub write target differs from the approved target." if {
	input.action.type == "github_write"
	object.get(object.get(input, "authorization", {}), "approved_target", null) != input.action.target
}

write_violations contains "GitHub write repository is not allowed." if {
	input.action.type == "github_write"
	input.action.target.repo != "ashleybrookeugc/research-vault"
}

write_violations contains "GitHub write path is not allowed." if {
	input.action.type == "github_write"
	not input.action.target.path in {"ACTIVE_WORK.md", "SIDE_IDEAS.md"}
}

violations := schema_violations | completion_violations | write_violations

allow if count(violations) == 0

decision := {"allow": allow, "violations": violations}
