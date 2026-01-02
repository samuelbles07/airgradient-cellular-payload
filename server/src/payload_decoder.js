/**
 * AirGradient Cellular Payload Decoder
 * Decodes binary payload format for cellular transmission
 */

const { SensorFlag, SensorFieldNames, SensorInfo } = require('./payload_types');

/**
 * Decode metadata byte (byte 0)
 * @param {number} metadata - Metadata byte
 * @returns {Object} { version, dualMode, dedicatedTempHumSensor }
 */
function decodeMetadata(metadata) {
  const version = metadata & 0x07;  // Bits 0-2
  const dualMode = (metadata & 0x08) !== 0;  // Bit 3
  const dedicatedTempHumSensor = (metadata & 0x10) !== 0;  // Bit 4
  return { version, dualMode, dedicatedTempHumSensor };
}

/**
 * Check if a flag is set in the presence mask
 * @param {number} mask - 32-bit presence mask
 * @param {number} flag - Flag bit position (0-26)
 * @returns {boolean}
 */
function isFlagSet(mask, flag) {
  return (mask & (1 << flag)) !== 0;
}

/**
 * Check if a sensor field is expandable (sends 2 values in dual mode)
 * @param {number} flag - Sensor flag
 * @param {boolean} dedicatedTempHumSensor - Dedicated temp/hum sensor flag
 * @returns {boolean}
 */
function isExpandable(flag, dedicatedTempHumSensor) {
  // Temp/Hum are NOT expandable if dedicated sensor is used
  if ((flag === SensorFlag.FLAG_TEMP || flag === SensorFlag.FLAG_HUM) && dedicatedTempHumSensor) {
    return false;
  }
  const info = SensorInfo[flag];
  return info ? info.expandable : false;
}

/**
 * Read uint16 from buffer (little-endian)
 * @param {Buffer} buffer - Buffer to read from
 * @param {number} offset - Offset to read at
 * @returns {number}
 */
function readUint16LE(buffer, offset) {
  return buffer.readUInt16LE(offset);
}

/**
 * Read int16 from buffer (little-endian)
 * @param {Buffer} buffer - Buffer to read from
 * @param {number} offset - Offset to read at
 * @returns {number}
 */
function readInt16LE(buffer, offset) {
  return buffer.readInt16LE(offset);
}

/**
 * Read uint32 from buffer (little-endian)
 * @param {Buffer} buffer - Buffer to read from
 * @param {number} offset - Offset to read at
 * @returns {number}
 */
function readUint32LE(buffer, offset) {
  return buffer.readUInt32LE(offset);
}

/**
 * Read int8 from buffer
 * @param {Buffer} buffer - Buffer to read from
 * @param {number} offset - Offset to read at
 * @returns {number}
 */
function readInt8(buffer, offset) {
  return buffer.readInt8(offset);
}

/**
 * Read presence mask from buffer (32-bit little-endian)
 * @param {Buffer} buffer - Buffer to read from
 * @param {number} offset - Offset to read at
 * @returns {number}
 */
function readPresenceMask(buffer, offset) {
  return readUint32LE(buffer, offset);
}

/**
 * Decode sensor data based on presence mask
 * @param {Buffer} buffer - Buffer containing sensor data
 * @param {number} offset - Starting offset
 * @param {number} presenceMask - 32-bit presence mask
 * @param {boolean} dualMode - Dual channel mode flag
 * @param {boolean} dedicatedTempHumSensor - Dedicated temp/hum sensor flag
 * @param {boolean} applyScaling - Apply scaling factors to values
 * @returns {Object} { data, bytesRead }
 */
function decodeSensorData(buffer, offset, presenceMask, dualMode, dedicatedTempHumSensor, applyScaling = true) {
  let currentOffset = offset;
  const data = {};

  // Iterate through flags in order (0-26)
  for (let flag = 0; flag <= SensorFlag.FLAG_SIGNAL; flag++) {
    if (!isFlagSet(presenceMask, flag)) {
      continue;  // Skip if flag not set
    }

    const fieldName = SensorFieldNames[flag];
    const info = SensorInfo[flag];
    const expandable = isExpandable(flag, dedicatedTempHumSensor);
    const valueCount = (expandable && dualMode) ? 2 : 1;

    // Read value(s) based on type
    if (info.type === 'int8') {
      // Signed 8-bit (signal strength)
      const rawValue = readInt8(buffer, currentOffset);
      data[fieldName] = applyScaling ? rawValue / info.scale : rawValue;
      currentOffset += 1;
    } else if (info.type === 'uint32') {
      // 32-bit fields (always scalar)
      const rawValue = readUint32LE(buffer, currentOffset);
      data[fieldName] = applyScaling ? rawValue / info.scale : rawValue;
      currentOffset += 4;
    } else if (info.type === 'int16') {
      // Signed 16-bit (temperature)
      const values = [];
      for (let i = 0; i < valueCount; i++) {
        const rawValue = readInt16LE(buffer, currentOffset);
        values.push(applyScaling ? rawValue / info.scale : rawValue);
        currentOffset += 2;
      }
      data[fieldName] = valueCount === 1 ? values[0] : values;
    } else {
      // Unsigned 16-bit
      const values = [];
      for (let i = 0; i < valueCount; i++) {
        const rawValue = readUint16LE(buffer, currentOffset);
        values.push(applyScaling ? rawValue / info.scale : rawValue);
        currentOffset += 2;
      }
      data[fieldName] = valueCount === 1 ? values[0] : values;
    }
  }

  return {
    data,
    bytesRead: currentOffset - offset
  };
}

/**
 * Decode a single reading (presence mask + sensor data)
 * @param {Buffer} buffer - Buffer to decode
 * @param {number} offset - Starting offset
 * @param {boolean} dualMode - Dual channel mode
 * @param {boolean} dedicatedTempHumSensor - Dedicated temp/hum sensor flag
 * @param {boolean} applyScaling - Apply scaling factors
 * @returns {Object} { reading, bytesRead }
 */
function decodeReading(buffer, offset, dualMode, dedicatedTempHumSensor, applyScaling = true) {
  let currentOffset = offset;

  // Read presence mask (4 bytes)
  const presenceMask = readPresenceMask(buffer, currentOffset);
  currentOffset += 4;

  // Decode sensor data
  const { data, bytesRead } = decodeSensorData(
    buffer,
    currentOffset,
    presenceMask,
    dualMode,
    dedicatedTempHumSensor,
    applyScaling
  );
  currentOffset += bytesRead;

  return {
    reading: {
      presenceMask,
      ...data
    },
    bytesRead: currentOffset - offset
  };
}

/**
 * Decode complete payload with multiple readings
 * @param {Buffer} buffer - Complete payload buffer
 * @param {boolean} applyScaling - Apply scaling factors to sensor values
 * @returns {Object} Decoded payload with header and readings
 */
function decodePayload(buffer, applyScaling = true) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('Input must be a Buffer');
  }

  if (buffer.length < 2) {
    throw new Error('Buffer too small (minimum 2 bytes for header)');
  }

  let offset = 0;

  // Decode header (2 bytes)
  const metadata = buffer[offset++];
  const intervalMinutes = buffer[offset++];

  const { version, dualMode, dedicatedTempHumSensor } = decodeMetadata(metadata);

  const header = {
    version,
    dualMode,
    dedicatedTempHumSensor,
    intervalMinutes
  };

  // Decode all readings
  const readings = [];
  while (offset < buffer.length) {
    const { reading, bytesRead } = decodeReading(buffer, offset, dualMode, dedicatedTempHumSensor, applyScaling);
    readings.push(reading);
    offset += bytesRead;
  }

  return {
    header,
    readings,
    readingCount: readings.length
  };
}

/**
 * Decode payload and return raw values (no scaling applied)
 * @param {Buffer} buffer - Complete payload buffer
 * @returns {Object} Decoded payload with raw sensor values
 */
function decodePayloadRaw(buffer) {
  return decodePayload(buffer, false);
}

/**
 * Convert decoded payload to JSON string
 * @param {Buffer} buffer - Complete payload buffer
 * @param {boolean} pretty - Pretty print JSON
 * @returns {string} JSON string
 */
function decodePayloadToJSON(buffer, pretty = false) {
  const decoded = decodePayload(buffer);
  return pretty ? JSON.stringify(decoded, null, 2) : JSON.stringify(decoded);
}

// Export all functions
module.exports = {
  decodeMetadata,
  isFlagSet,
  isExpandable,
  readUint16LE,
  readInt16LE,
  readUint32LE,
  readInt8,
  readPresenceMask,
  decodeSensorData,
  decodeReading,
  decodePayload,
  decodePayloadRaw,
  decodePayloadToJSON
};
