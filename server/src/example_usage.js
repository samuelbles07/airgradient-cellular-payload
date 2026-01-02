/**
 * Example Usage - AirGradient Payload Decoder
 * How to use the decoder in your CoAP server
 */

const { decodePayload, decodePayloadToJSON } = require('./payload_decoder');

// ========================================
// Example 1: Basic Usage
// ========================================
console.log('=== Example 1: Basic Decoding ===\n');

// Simulated payload from CoAP request
const payload = Buffer.from([
  0x01,       // Version 1, Single mode
  0x05,       // 5 minute interval
  0x05, 0x00, 0x00, 0x00,  // Temp + CO2
  0xC4, 0x09,              // 25.00°C
  0x90, 0x01               // 400 ppm
]);

const decoded = decodePayload(payload);
console.log('Decoded:', decoded);
console.log('\n');

// ========================================
// Example 2: CoAP Server Integration
// ========================================
console.log('=== Example 2: CoAP Server Integration ===\n');

/**
 * Example CoAP request handler
 */
function handleCoapRequest(req, res) {
  try {
    // Get payload buffer from CoAP request
    const payloadBuffer = req.payload;  // Buffer

    // Decode the payload
    const data = decodePayload(payloadBuffer);

    console.log(`Received ${data.readingCount} reading(s)`);
    console.log(`Version: ${data.header.version}`);
    console.log(`Interval: ${data.header.intervalMinutes} minutes`);
    console.log(`Dual Mode: ${data.header.dualMode}`);

    // Process each reading
    data.readings.forEach((reading, index) => {
      console.log(`\nReading ${index + 1}:`);

      if (reading.temperature !== undefined) {
        console.log(`  Temperature: ${reading.temperature}°C`);
      }
      if (reading.humidity !== undefined) {
        console.log(`  Humidity: ${reading.humidity}%`);
      }
      if (reading.co2 !== undefined) {
        console.log(`  CO2: ${reading.co2} ppm`);
      }
      if (reading.pm25 !== undefined) {
        console.log(`  PM2.5: ${reading.pm25} µg/m³`);
      }
      // ... check other sensors as needed
    });

    // Send response (example)
    res.end('OK');

    // Store to database, forward to API, etc.
    // saveToDatabase(data);

  } catch (error) {
    console.error('Decode error:', error.message);
    res.code = '4.00';  // Bad Request
    res.end('Invalid payload');
  }
}

// Simulate handling a request
const mockRequest = {
  payload: Buffer.from([
    0x01, 0x05,
    0x05, 0x00, 0x00, 0x00,
    0xC4, 0x09,
    0x90, 0x01
  ])
};

const mockResponse = {
  code: '2.05',
  end: (msg) => console.log(`Response: ${msg}`)
};

handleCoapRequest(mockRequest, mockResponse);
console.log('\n');

// ========================================
// Example 3: Batch Processing
// ========================================
console.log('=== Example 3: Batch Processing ===\n');

const batchPayload = Buffer.from([
  0x01, 0x05,
  // Reading 1
  0x04, 0x00, 0x00, 0x00,
  0x90, 0x01,
  // Reading 2
  0x04, 0x00, 0x00, 0x00,
  0x9A, 0x01,
  // Reading 3
  0x04, 0x00, 0x00, 0x00,
  0xA4, 0x01
]);

const batchData = decodePayload(batchPayload);
console.log(`Received batch of ${batchData.readingCount} readings`);

batchData.readings.forEach((reading, idx) => {
  console.log(`  Reading ${idx + 1}: CO2 = ${reading.co2} ppm`);
});
console.log('\n');

// ========================================
// Example 4: Extract Specific Sensors
// ========================================
console.log('=== Example 4: Extract Specific Sensors ===\n');

function extractSensorValues(decodedPayload, sensorName) {
  return decodedPayload.readings
    .map(r => r[sensorName])
    .filter(v => v !== undefined);
}

const allCO2 = extractSensorValues(batchData, 'co2');
console.log('All CO2 values:', allCO2);

const avgCO2 = allCO2.reduce((a, b) => a + b, 0) / allCO2.length;
console.log(`Average CO2: ${avgCO2.toFixed(2)} ppm`);
console.log('\n');

// ========================================
// Example 5: Convert to JSON for API
// ========================================
console.log('=== Example 5: JSON Output ===\n');

const jsonOutput = decodePayloadToJSON(payload, true);
console.log('JSON Output:');
console.log(jsonOutput);
console.log('\n');

// ========================================
// Example 6: Error Handling
// ========================================
console.log('=== Example 6: Error Handling ===\n');

function safeDecodePayload(buffer) {
  try {
    return {
      success: true,
      data: decodePayload(buffer)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Valid payload
const result1 = safeDecodePayload(payload);
console.log('Valid payload:', result1.success);

// Invalid payload (too short)
const result2 = safeDecodePayload(Buffer.from([0x01]));
console.log('Invalid payload:', result2.success, '-', result2.error);
console.log('\n');

// ========================================
// Example 7: Working with Dual Channel
// ========================================
console.log('=== Example 7: Dual Channel Data ===\n');

const dualPayload = Buffer.from([
  0x09, 0x05,  // Dual mode
  0x03, 0x00, 0x00, 0x00,  // Temp + Humidity
  0xC4, 0x09,  // Temp[0]
  0x28, 0x0A,  // Temp[1]
  0x70, 0x17,  // Hum[0]
  0xCE, 0x17   // Hum[1]
]);

const dualData = decodePayload(dualPayload);
const reading = dualData.readings[0];

if (Array.isArray(reading.temperature)) {
  console.log(`Temperature (dual): ${reading.temperature[0]}°C / ${reading.temperature[1]}°C`);
  console.log(`Humidity (dual): ${reading.humidity[0]}% / ${reading.humidity[1]}%`);
} else {
  console.log(`Temperature (single): ${reading.temperature}°C`);
}
console.log('\n');

console.log('=== Examples Complete ===');
