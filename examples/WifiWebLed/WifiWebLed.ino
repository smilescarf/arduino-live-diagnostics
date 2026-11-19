// 10 · 网页控灯与 JSON 局部刷新
// 接线：LED41 经 1kΩ 接地；手机/电脑与开发板连同一局域网。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：开发板核心自带
// 来源：10-1 WIF理论与实战.pptx 第 18、19、20 页
// 预期现象：浏览器打开串口显示的 http://IP，按钮通过 fetch 控灯；页面显示设备返回的实际状态。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：WIFI_SSID；WIFI_PASSWORD；LED_PIN = 41
// 注意：用于可信局域网内的低压 LED 实验；未实现用户鉴权，不要映射到公网。WebServer 请求处理存在有界等待。

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
#include <WebServer.h>
const int LED_PIN=41;
WebServer web(80);
bool ledOn=false;
const char PAGE[] PROGMEM=R"HTML(<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Arduino LED</title>
<h1>LED 实验</h1><p id="status">正在读取</p><button onclick="setLed(1)">点亮</button><button onclick="setLed(0)">熄灭</button>
<script>async function refresh(){try{const r=await fetch('/getled');if(!r.ok)throw Error();const d=await r.json();document.getElementById('status').textContent=d.state?'已点亮':'已熄灭';}catch(e){document.getElementById('status').textContent='连接失败，请重试';}}
async function setLed(v){try{const r=await fetch('/setled?val='+v,{method:'POST'});if(!r.ok)throw Error();await refresh();}catch(e){document.getElementById('status').textContent='控制失败，请重试';}}refresh();</script>)HTML";
void sendState() { web.send(200,"application/json",ledOn ? R"JSON({"state":1})JSON" : R"JSON({"state":0})JSON"); }
void registerRoutes() {
  web.on("/",HTTP_GET,[](){ web.send_P(200,"text/html; charset=utf-8",PAGE); });
  web.on("/getled",HTTP_GET,sendState);
  web.on("/setled",HTTP_POST,[](){
    const String value=web.arg("val");
    if (value!="0" && value!="1") { web.send(400,"text/plain","val must be 0 or 1"); return; }
    ledOn=value=="1"; digitalWrite(LED_PIN,ledOn ? HIGH : LOW); sendState();
  });
  web.onNotFound([](){web.send(404,"text/plain","Not found");});
}
bool started=false, timedOut=false;
unsigned long startedAt=0;
void setup() {
  Serial.begin(115200); pinMode(LED_PIN,OUTPUT); digitalWrite(LED_PIN,LOW); registerRoutes();
  WiFi.mode(WIFI_STA); WiFi.begin(WIFI_SSID,WIFI_PASSWORD); startedAt=millis();
}
void loop() {
  if (WiFi.status()==WL_CONNECTED) {
    if (!started) { started=true; web.begin(); Serial.print("http://"); Serial.println(WiFi.localIP()); }
    web.handleClient();
  } else if (!timedOut && millis()-startedAt>15000) { timedOut=true; WiFi.disconnect(); Serial.println("入网超时，请检查凭据并复位"); }
}
