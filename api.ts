import type LifxApp from './app';

module.exports = {
  async testCloudToken({
    homey,
    body,
  }: {
    homey: { app: LifxApp };
    body: { token?: string };
  }): Promise<{ ok: boolean; sceneCount?: number; error?: string }> {
    const token = (body?.token ?? '').trim();
    return homey.app.testCloudToken(token);
  },
};
