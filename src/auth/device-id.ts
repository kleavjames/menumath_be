import { BadRequestException } from '@nestjs/common';

export const DEVICE_ID_ERROR = 'deviceId is required';

export function requireDeviceId(value: unknown): string {
  if (typeof value !== 'string') {
    throw new BadRequestException(DEVICE_ID_ERROR);
  }

  const deviceId = value.trim();

  if (deviceId.length < 1) {
    throw new BadRequestException(DEVICE_ID_ERROR);
  }

  return deviceId;
}
