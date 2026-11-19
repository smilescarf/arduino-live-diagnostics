// 10 · TCP 按行指令控灯
// 接线：LED41 经 1kΩ 接地；电脑和 ESP32 接入同一个 2.4GHz 局域网。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：开发板核心自带
// 来源：10-1 WIF理论与实战.pptx 第 14、15、16、17 页
// 预期现象：电脑连接串口输出的 IP:8080，发送 ON 或 OFF 并带换行；收到状态回复。支持拆包、粘包和超长行拒绝。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：WIFI_SSID；WIFI_PASSWORD；TCP_PORT = 8080；LED_PIN = 41
// 注意：IP 由路由器 DHCP 分配，以串口为准；同一客户端空闲 30 秒关闭。入网失败后修正凭据并复位。

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
const int LED_PIN=41, TCP_PORT=8080;
WiFiServer server(TCP_PORT);
WiFiClient client;
char line[65];
size_t used=0;
bool discarding=false, started=false, timedOut=false;
unsigned long connectedAt=0, lastRx=0;
void setup() {
  Serial.begin(115200); pinMode(LED_PIN,OUTPUT); digitalWrite(LED_PIN,LOW);
  WiFi.mode(WIFI_STA); WiFi.begin(WIFI_SSID,WIFI_PASSWORD); connectedAt=millis();
}
void loop() {
  const unsigned long now=millis();
  if (WiFi.status()!=WL_CONNECTED) {
    if (!timedOut && now-connectedAt>15000) { Serial.println("Wi-Fi 入网超时，请检查凭据并复位"); WiFi.disconnect(); timedOut=true; }
    if (client) client.stop(); return;
  }
  if (!started) { server.begin(); started=true; Serial.print("TCP IP: "); Serial.println(WiFi.localIP()); }
  WiFiClient incoming=server.accept();
  if (incoming) {
    if (client && client.connected()) { incoming.println("BUSY"); incoming.stop(); }
    else { client=incoming; used=0; discarding=false; lastRx=now; client.println("Send ON or OFF + newline"); }
  }
  for (int budget=0; client && client.available() && budget<128; ++budget) {
    const char c=char(client.read()); lastRx=now;
    if (c=='\r') continue;
    if (c=='\n') {
      if (discarding) client.println("ERROR: line too long");
      else {
        line[used]='\0';
        if (!strcmp(line,"ON")) { digitalWrite(LED_PIN,HIGH); client.println("OK ON"); }
        else if (!strcmp(line,"OFF")) { digitalWrite(LED_PIN,LOW); client.println("OK OFF"); }
        else client.println("ERROR: use ON/OFF");
      }
      used=0; discarding=false;
    } else if (used<sizeof(line)-1 && !discarding) line[used++]=c;
    else discarding=true;
  }
  if (client && now-lastRx>30000) { client.stop(); used=0; discarding=false; }
}
