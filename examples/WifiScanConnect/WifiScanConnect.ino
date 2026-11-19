// 10 · Wi-Fi 扫描与限时入网
// 接线：ESP32-S3 与 USB 数据线，无外接器件；串口 115200。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：开发板核心自带
// 来源：10-1 WIF理论与实战.pptx 第 12、13 页
// 预期现象：异步扫描 2.4GHz 网络，随后尝试入网；成功打印 IP/RSSI，失败提示检查信息，不会永远等待。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：WIFI_SSID；WIFI_PASSWORD；CONNECT_TIMEOUT_MS = 15000

#if !defined(CONFIG_IDF_TARGET_ESP32S3)
#error "This course template requires ESP32-S3 and Arduino-ESP32 3.x"
#endif
#include <esp_arduino_version.h>
#if ESP_ARDUINO_VERSION_MAJOR < 3
#error "Please install Arduino-ESP32 3.x"
#endif

#include <WiFi.h>
// 只填你有权使用的 2.4GHz 网络；请勿把真实密码提交 GitHub。
const char *WIFI_SSID="YOUR_WIFI_SSID";
const char *WIFI_PASSWORD="YOUR_WIFI_PASSWORD";
const unsigned long CONNECT_TIMEOUT_MS=15000;
int stage=0;
unsigned long started=0;
void setup() { Serial.begin(115200); WiFi.mode(WIFI_STA); WiFi.scanNetworks(true); started=millis(); }
void loop() {
  const unsigned long now=millis();
  if (stage==0) {
    const int n=WiFi.scanComplete();
    if (n>=0 || now-started>=15000) {
      for (int i=0; i<n; ++i) Serial.printf("%s %d dBm\n",WiFi.SSID(i).c_str(),WiFi.RSSI(i));
      WiFi.scanDelete();
      if (String(WIFI_SSID)=="YOUR_WIFI_SSID") { Serial.println("请先填写 Wi-Fi 名称和密码"); stage=3; return; }
      WiFi.begin(WIFI_SSID,WIFI_PASSWORD); started=now; stage=1;
    } else if (n==WIFI_SCAN_FAILED) { Serial.println("扫描失败，请复位重试"); stage=3; }
  } else if (stage==1) {
    if (WiFi.status()==WL_CONNECTED) { Serial.print("IP: "); Serial.println(WiFi.localIP()); Serial.println(WiFi.RSSI()); stage=2; }
    else if (now-started>=CONNECT_TIMEOUT_MS) { WiFi.disconnect(); Serial.println("入网超时：检查 2.4GHz/名称/密码"); stage=3; }
  }
}
