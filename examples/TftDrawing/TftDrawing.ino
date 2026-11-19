// 08 · ST7789 图形与文字
// 接线：240×320 ST7789：3.3V、GND、SCK12、MOSI11、DC14、CS10、RST4；背光按模块额定电流供电，勿由普通 GPIO 直接供大电流。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：LovyanGFX
// 来源：8-1 TFT-LCD显示.pptx 第 9、10 页
// 预期现象：显示文字、圆和直线；每秒在底部更新计数。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：SCK=12 MOSI=11 DC=14 CS=10 RST=4；panel_width=240 panel_height=320
// 注意：默认 SPI 40MHz、mode0，与课件示例一致选择 mode0 并降低频率；花屏先查接线和模块规格，再调速率、偏移与反色。

#if !defined(CONFIG_IDF_TARGET_ESP32S3)
#error "This course template requires ESP32-S3 and Arduino-ESP32 3.x"
#endif
#include <esp_arduino_version.h>
#if ESP_ARDUINO_VERSION_MAJOR < 3
#error "Please install Arduino-ESP32 3.x"
#endif

#include <LovyanGFX.hpp>
class CourseDisplay : public lgfx::LGFX_Device {
  lgfx::Panel_ST7789 panel;
  lgfx::Bus_SPI bus;
public:
  CourseDisplay() {
    auto cfg=bus.config();
    cfg.spi_host=SPI2_HOST; cfg.spi_mode=0; cfg.freq_write=40000000; cfg.freq_read=16000000;
    cfg.spi_3wire=true; cfg.use_lock=true; cfg.dma_channel=SPI_DMA_CH_AUTO;
    cfg.pin_sclk=12; cfg.pin_mosi=11; cfg.pin_miso=-1; cfg.pin_dc=14;
    bus.config(cfg); panel.setBus(&bus);
    auto p=panel.config(); p.pin_cs=10; p.pin_rst=4;
    p.panel_width=240; p.panel_height=320; p.offset_x=0; p.offset_y=0;
    p.invert=false; p.rgb_order=false; panel.config(p); setPanel(&panel);
  }
};
CourseDisplay lcd;
unsigned long previous=0;
unsigned long counter=0;
void setup() {
  lcd.init(); lcd.setRotation(0); lcd.fillScreen(TFT_BLACK);
  lcd.setTextColor(TFT_WHITE,TFT_BLACK); lcd.setTextSize(2); lcd.setCursor(10,10); lcd.print("Hello ESP32-S3");
  lcd.drawCircle(120,140,30,TFT_RED); lcd.fillCircle(120,140,20,TFT_BLUE); lcd.drawLine(10,200,230,200,TFT_YELLOW);
}
void loop() { const unsigned long now=millis(); if (now-previous>=1000) { previous=now; lcd.fillRect(10,240,220,30,TFT_BLACK); lcd.setCursor(10,240); lcd.print(++counter); } }
