import { AccessToken, TokenVerifier } from 'livekit-server-sdk';
import { config } from '../../config';

export class LiveKitService {
  private static instance: LiveKitService;

  public static getInstance(): LiveKitService {
    if (!LiveKitService.instance) {
      LiveKitService.instance = new LiveKitService();
    }
    return LiveKitService.instance;
  }

  public async generateRoomToken(params: {
    roomName: string;
    participantIdentity: string;
    participantName: string;
  }): Promise<{ token: string; serverUrl: string; isConfigured: boolean }> {
    const isConfigured =
      !!config.livekit.apiKey &&
      config.livekit.apiKey !== 'devkey' &&
      !!config.livekit.apiSecret &&
      !config.livekit.apiSecret.startsWith('secret_synctheater');

    const at = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
      identity: params.participantIdentity,
      name: params.participantName,
      ttl: '2h',
    });

    at.addGrant({
      roomJoin: true,
      room: params.roomName,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();
    return {
      token,
      serverUrl: config.livekit.url,
      isConfigured,
    };
  }

  public async verifyRoomToken(token: string): Promise<any> {
    const verifier = new TokenVerifier(config.livekit.apiKey, config.livekit.apiSecret);
    return verifier.verify(token);
  }
}

export const liveKitService = LiveKitService.getInstance();
