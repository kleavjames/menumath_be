import { BadRequestException } from '@nestjs/common';

export const DEVICE_ID_ERROR =
  'deviceId is required and must be 1-128 characters';

export function requireDeviceId(value: unknown): string {
  if (typeof value !== 'string') {
    throw new BadRequestException(DEVICE_ID_ERROR);
  }

  const deviceId = value.trim();

  if (deviceId.length < 1 || deviceId.length > 128) {
    throw new BadRequestException(DEVICE_ID_ERROR);
  }

  return deviceId;
}
