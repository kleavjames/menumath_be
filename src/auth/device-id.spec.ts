import { BadRequestException } from '@nestjs/common';
import { requireDeviceId } from './device-id.js';

describe('requireDeviceId', () => {
  it('accepts an Android device id', () => {
    expect(requireDeviceId('dd96dec43fb81c97')).toBe('dd96dec43fb81c97');
  });

  it('accepts a device id longer than 128 characters', () => {
    const deviceId = 'a'.repeat(200);

    expect(requireDeviceId(deviceId)).toBe(deviceId);
  });

  it('rejects a blank device id', () => {
    expect(() => requireDeviceId('   ')).toThrow(BadRequestException);
  });
});
