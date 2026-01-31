#include "payload_encoder.h"
#include "unity.h"

PayloadEncoder encoder;

void setUp(void) {
}

void tearDown(void) {
}

static PayloadHeader makeHeader(uint8_t interval_minutes) {
  PayloadHeader header = {interval_minutes};
  return header;
}

// Test: RFC example (Temp + CO2)
void test_encode_temp_and_co2(void) {
  encoder.init(makeHeader(5));

  SensorReading reading;
  initSensorReading(&reading);

  setFlag(&reading, FLAG_TEMP);
  reading.temp = 2500; // 25.00C

  setFlag(&reading, FLAG_CO2);
  reading.co2 = 400;

  encoder.addReading(reading);

  uint8_t buffer[64];
  int32_t size = encoder.encode(buffer, sizeof(buffer));

  // 2 (header) + 8 (mask) + 2 (temp) + 2 (co2) = 14
  TEST_ASSERT_EQUAL_INT32(14, size);

  // Metadata: version=0, shared-mask bit set (single reading is treated as shared)
  TEST_ASSERT_EQUAL_UINT8(0x20, buffer[0]);
  TEST_ASSERT_EQUAL_UINT8(0x05, buffer[1]);

  // Mask: bits 0 and 2 => 0x0000000000000005 (little-endian)
  TEST_ASSERT_EQUAL_UINT8(0x05, buffer[2]);
  TEST_ASSERT_EQUAL_UINT8(0x00, buffer[3]);
  TEST_ASSERT_EQUAL_UINT8(0x00, buffer[4]);
  TEST_ASSERT_EQUAL_UINT8(0x00, buffer[5]);
  TEST_ASSERT_EQUAL_UINT8(0x00, buffer[6]);
  TEST_ASSERT_EQUAL_UINT8(0x00, buffer[7]);
  TEST_ASSERT_EQUAL_UINT8(0x00, buffer[8]);
  TEST_ASSERT_EQUAL_UINT8(0x00, buffer[9]);

  // Temp (2500 = 0x09C4)
  TEST_ASSERT_EQUAL_UINT8(0xC4, buffer[10]);
  TEST_ASSERT_EQUAL_UINT8(0x09, buffer[11]);

  // CO2 (400 = 0x0190)
  TEST_ASSERT_EQUAL_UINT8(0x90, buffer[12]);
  TEST_ASSERT_EQUAL_UINT8(0x01, buffer[13]);
}

void test_encode_humidity_only(void) {
  encoder.init(makeHeader(10));

  SensorReading reading;
  initSensorReading(&reading);

  setFlag(&reading, FLAG_HUM);
  reading.hum = 6550; // 65.50%

  encoder.addReading(reading);

  uint8_t buffer[64];
  int32_t size = encoder.encode(buffer, sizeof(buffer));

  // 2 + 8 + 2 = 12
  TEST_ASSERT_EQUAL_INT32(12, size);

  // Mask: bit 1 => 0x0000000000000002
  TEST_ASSERT_EQUAL_UINT8(0x02, buffer[2]);
  TEST_ASSERT_EQUAL_UINT8(0x00, buffer[3]);

  // Humidity (6550 = 0x1996)
  TEST_ASSERT_EQUAL_UINT8(0x96, buffer[10]);
  TEST_ASSERT_EQUAL_UINT8(0x19, buffer[11]);
}

void test_encode_pm25_two_channel(void) {
  encoder.init(makeHeader(5));

  SensorReading reading;
  initSensorReading(&reading);

  setFlag(&reading, FLAG_PM_25_CH1);
  reading.pm_25[0] = 125;

  setFlag(&reading, FLAG_PM_25_CH2);
  reading.pm_25[1] = 135;

  encoder.addReading(reading);

  uint8_t buffer[64];
  int32_t size = encoder.encode(buffer, sizeof(buffer));

  // 2 + 8 + 2 + 2 = 14
  TEST_ASSERT_EQUAL_INT32(14, size);

  // Mask: bits 8 and 9 => 0x0000000000000300
  TEST_ASSERT_EQUAL_UINT8(0x00, buffer[2]);
  TEST_ASSERT_EQUAL_UINT8(0x03, buffer[3]);

  // Data order: CH1 (bit 8) then CH2 (bit 9)
  TEST_ASSERT_EQUAL_UINT8(0x7D, buffer[10]);
  TEST_ASSERT_EQUAL_UINT8(0x00, buffer[11]);
  TEST_ASSERT_EQUAL_UINT8(0x87, buffer[12]);
  TEST_ASSERT_EQUAL_UINT8(0x00, buffer[13]);
}

void test_encode_o3_we_32bit(void) {
  encoder.init(makeHeader(5));

  SensorReading reading;
  initSensorReading(&reading);

  setFlag(&reading, FLAG_O3_WE);
  reading.o3_we = 0x12345678;

  encoder.addReading(reading);

  uint8_t buffer[64];
  int32_t size = encoder.encode(buffer, sizeof(buffer));

  // 2 + 8 + 4 = 14
  TEST_ASSERT_EQUAL_INT32(14, size);

  // Mask bit 24 => 0x0000000001000000 (low word)
  TEST_ASSERT_EQUAL_UINT8(0x00, buffer[2]);
  TEST_ASSERT_EQUAL_UINT8(0x00, buffer[3]);
  TEST_ASSERT_EQUAL_UINT8(0x00, buffer[4]);
  TEST_ASSERT_EQUAL_UINT8(0x01, buffer[5]);

  // O3_WE value little-endian
  TEST_ASSERT_EQUAL_UINT8(0x78, buffer[10]);
  TEST_ASSERT_EQUAL_UINT8(0x56, buffer[11]);
  TEST_ASSERT_EQUAL_UINT8(0x34, buffer[12]);
  TEST_ASSERT_EQUAL_UINT8(0x12, buffer[13]);
}

int main(void) {
  UNITY_BEGIN();

  RUN_TEST(test_encode_temp_and_co2);
  RUN_TEST(test_encode_humidity_only);
  RUN_TEST(test_encode_pm25_two_channel);
  RUN_TEST(test_encode_o3_we_32bit);

  return UNITY_END();
}
