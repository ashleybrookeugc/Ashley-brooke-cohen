// Opt-in gate with no endpoint. npm run eval:phrasing never loads this file.
export default class PaidModelRefused {
  id = () => 'paid-model-refused';

  callApi = async () => {
    if (process.env.PROMPTFOO_ENABLE_PAID_MODELS !== '1') {
      throw new Error('Paid model evals are off. CI and npm run eval:phrasing do not load this provider.');
    }
    throw new Error('PROMPTFOO_ENABLE_PAID_MODELS=1 but no model endpoint is configured. Refusing to select a paid provider.');
  };
}
