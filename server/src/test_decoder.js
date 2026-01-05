/**
 * Test file for AirGradient Payload Decoder
 * Run with: node test_decoder.js
 */

const { decodePayload, decodePayloadToJSON } = require('./payload_decoder');

// Test 1: RFC Example - Single Channel (Temp + CO2)
console.log('=== Test 1: RFC Example - Single Channel ===');
const test1Buffer = Buffer.from([
  0x01,       // Metadata (Version=1, Dual=0)
  0x05,       // Interval (5 minutes)
  0x05, 0x00, 0x00, 0x00,  // Presence Mask (bits 0, 2)
  0xC4, 0x09,              // Temp = 2500 (25.00°C)
  0x90, 0x01               // CO2 = 400 ppm
]);

const result1 = decodePayload(test1Buffer);
console.log(JSON.stringify(result1, null, 2));
console.log('Expected: version=1, dualMode=false, interval=5, temp=25, co2=400');
console.log('');

// Test 2: RFC Example - Dual Channel (Temp + CO2)
console.log('=== Test 2: RFC Example - Dual Channel ===');
const test2Buffer = Buffer.from([
  0x09,       // Metadata (Version=1, Dual=1)
  0x05,       // Interval (5 minutes)
  0x05, 0x00, 0x00, 0x00,  // Presence Mask (bits 0, 2)
  0xC4, 0x09,              // Temp[0] = 2500 (25.00°C)
  0x28, 0x0A,              // Temp[1] = 2600 (26.00°C)
  0x90, 0x01               // CO2 = 400 ppm
]);

const result2 = decodePayload(test2Buffer);
console.log(JSON.stringify(result2, null, 2));
console.log('Expected: version=1, dualMode=true, interval=5, temp=[25, 26], co2=400');
console.log('');

// Test 3: Multiple Readings - Single Channel
console.log('=== Test 3: Multiple Readings - Single Channel ===');
const test3Buffer = Buffer.from([
  0x01,       // Metadata (Version=1, Dual=0)
  0x05,       // Interval (5 minutes)
  // Reading 1
  0x05, 0x00, 0x00, 0x00,  // Presence Mask (bits 0, 2)
  0xC4, 0x09,              // Temp = 2500 (25.00°C)
  0x90, 0x01,              // CO2 = 400 ppm
  // Reading 2
  0x05, 0x00, 0x00, 0x00,  // Presence Mask (bits 0, 2)
  0x28, 0x0A,              // Temp = 2600 (26.00°C)
  0x9A, 0x01               // CO2 = 410 ppm
]);

const result3 = decodePayload(test3Buffer);
console.log(JSON.stringify(result3, null, 2));
console.log('Expected: 2 readings with different values');
console.log('');

// Test 4: Humidity only
console.log('=== Test 4: Humidity Only ===');
const test4Buffer = Buffer.from([
  0x01,       // Metadata
  0x0A,       // Interval (10 minutes)
  0x02, 0x00, 0x00, 0x00,  // Presence Mask (bit 1 = humidity)
  0x96, 0x19               // Humidity = 6550 (65.50%)
]);

const result4 = decodePayload(test4Buffer);
console.log(JSON.stringify(result4, null, 2));
console.log('Expected: humidity=65.5');
console.log('');

// Test 5: PM2.5 sensor
console.log('=== Test 5: PM2.5 Sensor ===');
const test5Buffer = Buffer.from([
  0x01,       // Metadata
  0x05,       // Interval
  0x00, 0x01, 0x00, 0x00,  // Presence Mask (bit 8 = PM2.5)
  0x7D, 0x00               // PM2.5 = 125 (12.5 µg/m³)
]);

const result5 = decodePayload(test5Buffer);
console.log(JSON.stringify(result5, null, 2));
console.log('Expected: pm25=12.5');
console.log('');

// Test 6: 32-bit field (O3_WE)
console.log('=== Test 6: 32-bit Field (O3 Working Electrode) ===');
const test6Buffer = Buffer.from([
  0x01,       // Metadata
  0x05,       // Interval
  0x00, 0x00, 0x20, 0x00,  // Presence Mask (bit 21 = O3_WE)
  0x78, 0x56, 0x34, 0x12   // O3_WE = 0x12345678
]);

const result6 = decodePayload(test6Buffer);
console.log(JSON.stringify(result6, null, 2));
console.log('Expected: o3_we=305419.896 (0x12345678 / 1000)');
console.log('');

// Test 7: Negative temperature
console.log('=== Test 7: Negative Temperature ===');
const test7Buffer = Buffer.from([
  0x01,       // Metadata
  0x05,       // Interval
  0x01, 0x00, 0x00, 0x00,  // Presence Mask (bit 0 = temp)
  0xE6, 0xFB               // Temp = -1050 (-10.50°C)
]);

const result7 = decodePayload(test7Buffer);
console.log(JSON.stringify(result7, null, 2));
console.log('Expected: temperature=-10.5');
console.log('');

// Test 8: Multiple sensors in single reading
console.log('=== Test 8: Multiple Sensors ===');
const test8Buffer = Buffer.from([
  0x01,       // Metadata
  0x05,       // Interval
  0x0F, 0x00, 0x00, 0x00,  // Presence Mask (bits 0,1,2,3 = temp,hum,co2,tvoc)
  0xC4, 0x09,              // Temp = 2500
  0x70, 0x17,              // Hum = 6000
  0x90, 0x01,              // CO2 = 400
  0x64, 0x00               // TVOC = 100
]);

const result8 = decodePayload(test8Buffer);
console.log(JSON.stringify(result8, null, 2));
console.log('Expected: temp=25, hum=60, co2=400, tvoc=100');
console.log('');

// Test 9: Dual mode with expandable and scalar mix
console.log('=== Test 9: Dual Mode - Mixed Fields ===');
const test9Buffer = Buffer.from([
  0x09,       // Metadata (Dual=1)
  0x05,       // Interval
  0x07, 0x00, 0x00, 0x00,  // Presence Mask (bits 0,1,2 = temp,hum,co2)
  0xC4, 0x09,              // Temp[0] = 2500
  0x28, 0x0A,              // Temp[1] = 2600
  0x70, 0x17,              // Hum[0] = 6000
  0xCE, 0x17,              // Hum[1] = 6094
  0x90, 0x01               // CO2 = 400 (scalar, only 1 value)
]);

const result9 = decodePayload(test9Buffer);
console.log(JSON.stringify(result9, null, 2));
console.log('Expected: temp=[25,26], hum=[60,60.94], co2=400');
console.log('');

// Test 10: FLAG_SIGNAL (new sensor - bit 26)
console.log('=== Test 10: Signal Strength (FLAG_SIGNAL) ===');
const test10Buffer = Buffer.from([
  0x01,       // Metadata (Version=1, Dual=0)
  0x05,       // Interval (5 minutes)
  0x00, 0x00, 0x00, 0x04,  // Presence Mask (bit 26 = signal)
  0xB5                     // Signal = -75 dBm (two's complement)
]);

const result10 = decodePayload(test10Buffer);
console.log(JSON.stringify(result10, null, 2));
console.log('Expected: signal=-75 (dBm)');
console.log('');

// Test 11: DEDICATED_TEMPHUM_SENSOR flag (bit 4 in metadata)
console.log('=== Test 11: Dedicated Temp/Hum Sensor (Bit 4) ===');
const test11Buffer = Buffer.from([
  0x19,       // Metadata (Version=1, Dual=1, Dedicated=1) = 0001 1001
  0x05,       // Interval (5 minutes)
  0x03, 0x01, 0x00, 0x00,  // Presence Mask (bits 0,1,8 = temp,hum,pm25)
  0xC4, 0x09,              // Temp (single value, even in dual mode)
  0x70, 0x17,              // Hum (single value, even in dual mode)
  0x7D, 0x00,              // PM25[0] = 125 (still dual)
  0x87, 0x00               // PM25[1] = 135 (still dual)
]);

const result11 = decodePayload(test11Buffer);
console.log(JSON.stringify(result11, null, 2));
console.log('Expected: dedicatedTempHumSensor=true, temp=25 (single), hum=60 (single), pm25=[12.5, 13.5] (dual)');
console.log('');

// Test 12: AFE_TEMP with new uint16 type (changed from uint32)
console.log('=== Test 12: AFE Temperature (uint16) ===');
const test12Buffer = Buffer.from([
  0x01,       // Metadata (Version=1, Dual=0)
  0x05,       // Interval (5 minutes)
  0x00, 0x00, 0x00, 0x02,  // Presence Mask (bit 25 = AFE_TEMP)
  0xFA, 0x00               // AFE_TEMP = 250 (25.0°C) - now 2 bytes instead of 4
]);

const result12 = decodePayload(test12Buffer);
console.log(JSON.stringify(result12, null, 2));
console.log('Expected: afe_temp=25.0 (°C)');
console.log('');

// Test 13: Combined test - Signal + Dedicated Sensor
console.log('=== Test 13: Signal + Temp/Hum with Dedicated Sensor ===');
const test13Buffer = Buffer.from([
  0x19,       // Metadata (Version=1, Dual=1, Dedicated=1)
  0x05,       // Interval (5 minutes)
  0x03, 0x00, 0x00, 0x04,  // Presence Mask (bits 0,1,26 = temp,hum,signal)
  0xC4, 0x09,              // Temp (single value)
  0x70, 0x17,              // Hum (single value)
  0xB5                     // Signal = -75 dBm
]);

const result13 = decodePayload(test13Buffer);
console.log(JSON.stringify(result13, null, 2));
console.log('Expected: dedicatedTempHumSensor=true, temp=25, hum=60, signal=-75');
console.log('');

console.log('=== All Tests Complete ===');
