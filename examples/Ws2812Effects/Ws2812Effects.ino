// 06 · WS2812 六种灯效与往返彗星
// 接线：8 灯 WS2812 数据接 GPIO7（串 330Ω），共地；供电按灯带规格，5V 灯带用外部电源和合适的 3.3V→5V 数据电平转换。勿由 GPIO 供电。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：FastLED
// 来源：6-1 WS2812灯带控制.pptx 第 15、16、17、18、19、20 页
// 预期现象：EFFECT：0三色轮换、1彩虹、2彗星、3往返彗星、4呼吸、5随机闪烁。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：DATA_PIN = 7；NUM_LEDS = 8；EFFECT = 0～5；BRIGHTNESS = 32
// 注意：默认亮度降低；课件中的 FastLtED、voidsetup、尾随 ar 拼写错误已修正。

#if !defined(CONFIG_IDF_TARGET_ESP32S3)
#error "This course template requires ESP32-S3 and Arduino-ESP32 3.x"
#endif
#include <esp_arduino_version.h>
#if ESP_ARDUINO_VERSION_MAJOR < 3
#error "Please install Arduino-ESP32 3.x"
#endif

#include <FastLED.h>
const uint8_t DATA_PIN = 7;
const int NUM_LEDS = 8;
const int EFFECT = 3;
const uint8_t BRIGHTNESS = 32;
CRGB leds[NUM_LEDS];
unsigned long previous = 0;
uint8_t hue = 0;
unsigned long frame = 0;
void setup() { FastLED.addLeds<WS2812B, DATA_PIN, GRB>(leds, NUM_LEDS); FastLED.setBrightness(BRIGHTNESS); FastLED.clear(true); }
void loop() {
  const unsigned long now = millis();
  if (now - previous < 40) return;
  previous = now; ++frame; ++hue;
  switch (EFFECT) {
    case 0: { const CRGB colors[] = {CRGB::Red, CRGB::Green, CRGB::Blue}; fill_solid(leds, NUM_LEDS, colors[(now/1000)%3]); break; }
    case 1: fill_rainbow(leds, NUM_LEDS, hue, 32); break;
    case 2: fadeToBlackBy(leds, NUM_LEDS, 80); leds[(frame/3)%NUM_LEDS] = CHSV(hue,255,255); break;
    case 3: {
      fadeToBlackBy(leds, NUM_LEDS, 40);
      // 上界必须是 NUM_LEDS-1，避免课件示意代码的越界。
      const int pos = map(triwave8(beat8(30)), 0,255, 0,NUM_LEDS-1);
      leds[pos] = CHSV(hue,255,255); break;
    }
    case 4: fill_solid(leds, NUM_LEDS, CHSV(hue,255,sin8(hue))); break;
    case 5: FastLED.clear(false); leds[random(NUM_LEDS)] = CHSV(random(256),255,255); break;
    default: FastLED.clear(false); break;
  }
  FastLED.show(); // 刷新仍有实际传输耗时；不承诺所有库版本均为异步 DMA。
}
