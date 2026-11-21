import { describe, it, expect, beforeEach } from 'vitest';
import { RealtimeStateManager } from '../src/realtime/state.manager';

describe('Realtime Video Synchronization Engine', () => {
  let stateManager: RealtimeStateManager;

  beforeEach(() => {
    stateManager = new RealtimeStateManager();
  });

  it('initializes room playback state with PAUSED status and sequence 1', async () => {
    const state = await stateManager.getOrCreateRoomState('room-1', 'test-cinema');
    expect(state.status).toBe('PAUSED');
    expect(state.currentPosition).toBe(0);
    expect(state.sequenceNumber).toBe(1);
    expect(state.isEmergencyPaused).toBe(false);
  });

  it('increments sequence numbers monotonically on playback actions', async () => {
    const state = await stateManager.getOrCreateRoomState('room-1', 'test-cinema');
    const seq0 = state.sequenceNumber;

    stateManager.play('room-1', 10);
    expect(state.sequenceNumber).toBe(seq0 + 1);
    expect(state.status).toBe('PLAYING');

    stateManager.pause('room-1', 15);
    expect(state.sequenceNumber).toBe(seq0 + 2);
    expect(state.status).toBe('PAUSED');

    stateManager.seek('room-1', 45);
    expect(state.sequenceNumber).toBe(seq0 + 3);
    expect(state.currentPosition).toBe(45);
  });

  it('computes accurate calculatedPosition based on elapsed wall-clock time', async () => {
    const state = await stateManager.getOrCreateRoomState('room-2', 'elapsed-test');
    stateManager.play('room-2', 100);
    // Simulate timestamp 5 seconds ago
    state.lastServerTimestamp = Date.now() - 5000;

    const snapshot = stateManager.getSnapshot(state);
    expect(snapshot.calculatedPosition).toBeGreaterThanOrEqual(104.9);
    expect(snapshot.calculatedPosition).toBeLessThanOrEqual(105.5);
  });

  it('triggers emergency pause and blocks normal play resumption until cleared', async () => {
    const state = await stateManager.getOrCreateRoomState('room-3', 'emergency-test');
    stateManager.play('room-3', 20);

    // Any participant activates emergency pause
    stateManager.emergencyPause('room-3', { userId: 'guest-99', username: 'ConcernedViewer' });
    expect(state.status).toBe('PAUSED');
    expect(state.isEmergencyPaused).toBe(true);
    expect(state.emergencyPausedBy?.username).toBe('ConcernedViewer');

    // Attempting normal play while emergency paused should throw error
    expect(() => stateManager.play('room-3', 25)).toThrowError(/Emergency Pause/);

    // Host resumes
    stateManager.resumeFromEmergency('room-3');
    expect(state.isEmergencyPaused).toBe(false);
    expect(state.status).toBe('PLAYING');
  });
});
