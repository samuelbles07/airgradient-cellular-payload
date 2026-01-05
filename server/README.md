# AirGradient Cellular Payload Decoder (JavaScript)

JavaScript/Node.js decoder for AirGradient binary cellular payload format.

## Installation

```bash
npm install
```

## Quick Start

```javascript
const { decodePayload } = require('./src/payload_decoder');

// Decode a payload buffer
const payloadBuffer = Buffer.from([
  0x01, 0x05,              // Header: version 1, single mode, 5 min interval
  0x05, 0x00, 0x00, 0x00,  // Presence mask: temp + co2
  0xC4, 0x09,              // Temperature: 25.00°C
  0x90, 0x01               // CO2: 400 ppm
]);

const decoded = decodePayload(payloadBuffer);
console.log(decoded);
```

Output:
```json
{
  "header": {
    "version": 1,
    "dualMode": false,
    "dedicatedTempHumSensor": false,
    "intervalMinutes": 5
  },
  "readings": [
    {
      "presenceMask": 5,
      "temperature": 25,
      "co2": 400
    }
  ],
  "readingCount": 1
}
```

## API Reference

### Main Functions

#### `decodePayload(buffer, applyScaling = true)`

Decodes a complete payload buffer.

**Parameters:**
- `buffer` (Buffer): The payload buffer to decode
- `applyScaling` (boolean): Apply scaling factors (default: true)

**Returns:** Object with `header`, `readings`, and `readingCount`

**Example:**
```javascript
const result = decodePayload(buffer);
console.log(result.header.version);
console.log(result.readings[0].temperature);
```

#### `decodePayloadRaw(buffer)`

Decodes payload without applying scaling factors (returns raw integer values).

**Example:**
```javascript
const raw = decodePayloadRaw(buffer);
// temperature will be 2500 instead of 25.00
```

#### `decodePayloadToJSON(buffer, pretty = false)`

Decodes payload and returns JSON string.

**Example:**
```javascript
const json = decodePayloadToJSON(buffer, true);  // Pretty printed
console.log(json);
```

### Helper Functions

- `decodeMetadata(metadata)` - Decode metadata byte (returns `{ version, dualMode, dedicatedTempHumSensor }`)
- `decodeReading(buffer, offset, dualMode, dedicatedTempHumSensor, applyScaling)` - Decode single reading
- `decodeSensorData(buffer, offset, presenceMask, dualMode, dedicatedTempHumSensor, applyScaling)` - Decode sensor data
- `isFlagSet(mask, flag)` - Check if flag is set in presence mask
- `isExpandable(flag, dedicatedTempHumSensor)` - Check if sensor field is expandable

## Usage in CoAP Server

```javascript
const { decodePayload } = require('./src/payload_decoder');
const coap = require('coap');

const server = coap.createServer();

server.on('request', (req, res) => {
  try {
    const data = decodePayload(req.payload);

    console.log(`Received ${data.readingCount} reading(s)`);

    data.readings.forEach((reading, index) => {
      if (reading.temperature) {
        console.log(`Reading ${index + 1}: ${reading.temperature}°C`);
      }
      if (reading.co2) {
        console.log(`Reading ${index + 1}: ${reading.co2} ppm`);
      }
    });

    // Store to database
    saveToDatabase(data);

    res.end('OK');
  } catch (error) {
    console.error('Decode error:', error);
    res.code = '4.00';
    res.end('Invalid payload');
  }
});

server.listen(5683);
```

## Sensor Fields

When decoded, readings may contain the following fields:

| Field Name | Type | Unit | Description |
|------------|------|------|-------------|
| `temperature` | number/array | °C | Temperature (expandable) |
| `humidity` | number/array | % | Humidity (expandable) |
| `co2` | number | ppm | CO2 concentration |
| `tvoc` | number | index | TVOC index |
| `tvoc_raw` | number | raw | TVOC raw value |
| `nox` | number | index | NOx index |
| `nox_raw` | number | raw | NOx raw value |
| `pm01` | number/array | µg/m³ | PM1.0 (expandable) |
| `pm25` | number/array | µg/m³ | PM2.5 (expandable) |
| `pm10` | number/array | µg/m³ | PM10 (expandable) |
| `pm01_sp` | number/array | µg/m³ | PM1.0 SP (expandable) |
| `pm25_sp` | number/array | µg/m³ | PM2.5 SP (expandable) |
| `pm10_sp` | number/array | µg/m³ | PM10 SP (expandable) |
| `pm03_pc` | number/array | count | PM0.3 count (expandable) |
| `pm05_pc` | number/array | count | PM0.5 count (expandable) |
| `pm01_pc` | number/array | count | PM1.0 count (expandable) |
| `pm25_pc` | number/array | count | PM2.5 count (expandable) |
| `pm5_pc` | number/array | count | PM5.0 count (expandable) |
| `pm10_pc` | number/array | count | PM10 count (expandable) |
| `vbat` | number | mV | Battery voltage |
| `vpanel` | number | mV | Panel voltage |
| `o3_we` | number | mV | O3 working electrode |
| `o3_ae` | number | mV | O3 aux electrode |
| `no2_we` | number | mV | NO2 working electrode |
| `no2_ae` | number | mV | NO2 aux electrode |
| `afe_temp` | number | °C | AFE chip temperature |

**Note:** Expandable fields return an array `[value0, value1]` in dual mode, or a single number in single mode.

## Dual Channel Mode

In dual channel mode, expandable fields send two values:

```javascript
// Single mode
{
  temperature: 25.0,
  pm25: 12.5
}

// Dual mode
{
  temperature: [25.0, 26.0],  // Two sensors
  pm25: [12.5, 13.0],         // Two sensors
  co2: 400                    // Scalar fields stay single
}
```

### Dedicated Temperature/Humidity Sensor

When the `dedicatedTempHumSensor` flag is set in the header (metadata bit 4), temperature and humidity values come from a dedicated sensor instead of the PM sensor. In this mode:

- **Temperature and Humidity**: Send only **1 value** even in dual channel mode
- **Other expandable fields** (PM sensors, particle counts): Still send **2 values** in dual channel mode
- **Scalar fields**: Always send **1 value** (unchanged)

```javascript
// Dual mode WITHOUT dedicated sensor
{
  dualMode: true,
  dedicatedTempHumSensor: false,
  temperature: [25.0, 26.0],  // Two values (from PM sensors)
  humidity: [60.0, 62.0],     // Two values (from PM sensors)
  pm25: [12.5, 13.5]          // Two values
}

// Dual mode WITH dedicated sensor
{
  dualMode: true,
  dedicatedTempHumSensor: true,
  temperature: 25.0,          // Single value (from dedicated sensor)
  humidity: 60.0,             // Single value (from dedicated sensor)
  pm25: [12.5, 13.5]          // Still dual values
}
```

This feature allows monitors with a dedicated temperature/humidity sensor to report accurate environmental data while still supporting dual PM sensors.

## Testing

Run the test suite:
```bash
npm test
```

Run examples:
```bash
npm run example
```

## Error Handling

The decoder throws errors for:
- Invalid buffer type (not Buffer)
- Buffer too small (< 2 bytes)
- Unexpected end of buffer

Always wrap decode calls in try-catch:

```javascript
try {
  const data = decodePayload(buffer);
  // Process data
} catch (error) {
  console.error('Decode failed:', error.message);
}
```

## Files

- `src/payload_types.js` - Type definitions and constants
- `src/payload_decoder.js` - Main decoder functions (copy/paste this)
- `src/test_decoder.js` - Test suite
- `src/example_usage.js` - Usage examples

## License

MIT
