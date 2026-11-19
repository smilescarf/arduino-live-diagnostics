// 08 · ST7789 滚动正弦波
// 接线：240×320 ST7789：3.3V、GND、SCK12、MOSI11、DC14、CS10、RST4；背光按模块额定电流供电，勿由普通 GPIO 直接供大电流。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：LovyanGFX
// 来源：8-1 TFT-LCD显示.pptx 第 11 页
// 预期现象：横屏绘制滚动波形，仅擦除旧曲线；数组在首帧之前初始化。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：FRAME_MS = 30；AMPLITUDE = 80
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
const unsigned long FRAME_MS=30;
const int WIDTH=320, CENTER=120, AMPLITUDE=80;
int prevY[WIDTH];
float phase=0;
unsigned long previous=0;
void setup() {
  lcd.init(); lcd.setRotation(1); lcd.fillScreen(TFT_BLACK);
  for (int x=0; x<WIDTH; ++x) prevY[x]=CENTER;
}
void loop() {
  const unsigned long now=millis(); if (now-previous<FRAME_MS) return; previous=now; phase+=0.15f;
  lcd.startWrite();
  for (int x=1; x<WIDTH; ++x) lcd.drawLine(x-1,prevY[x-1],x,prevY[x],TFT_BLACK);
  lcd.drawFastHLine(0,CENTER,WIDTH,TFT_DARKGREY);
  int y=CENTER+int(AMPLITUDE*sinf(phase)); prevY[0]=y;
  for (int x=1; x<WIDTH; ++x) {
    const int next=CENTER+int(AMPLITUDE*sinf(x*0.05f+phase));
    lcd.drawLine(x-1,y,x,next,TFT_CYAN); prevY[x]=next; y=next;
  }
  lcd.endWrite();
}
