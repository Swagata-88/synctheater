import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmergencyPauseBanner } from '../src/components/theater/EmergencyPauseBanner';

describe('EmergencyPauseBanner Component', () => {
  it('returns null when emergency pause is not active', () => {
    const { container } = render(
      <EmergencyPauseBanner
        isEmergencyPaused={false}
        isOwnerOrMod={false}
        onResume={() => {}}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders pulsating alert banner with caller details when emergency pause is active', () => {
    render(
      <EmergencyPauseBanner
        isEmergencyPaused={true}
        emergencyPausedBy={{ userId: 'user-456', username: 'SarahConnor' }}
        isOwnerOrMod={false}
        onResume={() => {}}
      />
    );

    expect(screen.getByText(/EMERGENCY PAUSE ACTIVATED/i)).toBeDefined();
    expect(screen.getByText(/SarahConnor/i)).toBeDefined();
  });

  it('provides resume button for room owner or moderator and triggers onResume', () => {
    const handleResume = vi.fn();

    render(
      <EmergencyPauseBanner
        isEmergencyPaused={true}
        emergencyPausedBy={{ userId: 'user-789', username: 'Alex' }}
        isOwnerOrMod={true}
        onResume={handleResume}
      />
    );

    const resumeBtn = screen.getByText(/Resume Playback/i);
    expect(resumeBtn).toBeDefined();

    fireEvent.click(resumeBtn);
    expect(handleResume).toHaveBeenCalledTimes(1);
  });
});
