// The requested development branch must not deploy automatically on push.
// Removal or enabling this guard requires Ashley's separate deployment approval.
if (process.env.VIDEO_TEST_DEPLOY_APPROVED !== '1' &&
    (process.env.CI || process.env.WORKERS_CI || process.env.WORKERS_CI_BRANCH)) {
  console.error('Video-testing development is not approved for deployment. Build stopped before upload.');
  process.exit(1);
}
