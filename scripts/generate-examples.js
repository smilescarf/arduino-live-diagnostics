'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { templates, templateCode, templateReadme } = require('../src/templates');
const root = path.resolve(__dirname, '..');
for (const template of templates) {
  const folder = path.join(root, 'examples', template.id);
  fs.mkdirSync(folder, { recursive: true });
  const board = template.boards ? template.boards[0] : '';
  fs.writeFileSync(path.join(folder, `${template.id}.ino`), templateCode(template, board));
  fs.writeFileSync(path.join(folder, 'README.md'), templateReadme(template, board));
}
const rows = templates.map(template => `| ${template.id} | ${template.title} | ${template.source ? template.source.file + ' p.' + template.source.pages.join(',') : '补充实验'} | ${template.libraries.join(', ') || '核心自带'} |`).join('\n');
fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs/EXPERIMENTS.md'), `# 实验模板索引\n\n共 ${templates.length} 个模板。命令面板运行 **Arduino Live: 实验模板**，支持按课次、器件、库、实验名称搜索。每个工程同时生成 .ino 与中文 README；仓库 examples 是相同源码的可直接打开副本。\n\n课件模板针对 ESP32-S3 / Arduino-ESP32 3.x，通用入门模板另支持 Uno。核心 3.3.12 编译验证与接线实测是不同层次，编译通过不代表已经实测你的模块。\n\n| 工程 | 实验 | 来源 | 外部库 |\n| --- | --- | --- | --- |\n${rows}\n\n## 课件核对与适配\n\n- 共 16 份 PPTX；9-1 光电模块与霍尔传感器1.pptx 的实际文字与 8-2 超声波测距及舵机应用.pptx 重复，因此光电/霍尔以 DigitalSensorCounter 补充实验实现，未虚构课件页码。\n- 理论页不逐页转换为工程；课件中明确示范的实验与作业按上表提供可独立编译的实现。Wi-Fi 概览中提及的天气服务/WebSocket、BLE 概览中的中心设备/iBeacon 是后续拓展方向，本版未声称已经实现。\n- WS2812 六种灯效通过 EFFECT 参数切换；音阶与警报通过 MODE 切换。\n- GPIO35～37 在部分 S3 模组连接 Flash/PSRAM；数码管与电压条默认改为 GPIO4～11，逐实验 README 有说明。\n- 修正课件示意代码的拼写/括号/数组上界问题；中断与无线回调只传递事件，主循环处理耗时操作；计时采用无符号差值。\n- 超声波 pulseIn 最长等待 25ms；FastLED.show 和同步 WebServer 也有处理耗时，本版不把它们描述成完全异步。\n- TFT 使用课件推荐 LovyanGFX；BLE 键盘采用核心内置 BLEHIDDevice，适配当前核心版本，免额外安装旧键盘库。\n- 外接模块按实际额定电压供电；ESP32 输入不可直接接 5V Echo，舵机独立供电且共地，继电器模板仅演示低压负载。\n- 原课件保留在本地，不打入 VSIX 或 GitHub 源码；避免数百 MB 的教学素材拖大插件。\n`);
console.log(`Generated ${templates.length} examples and docs/EXPERIMENTS.md`);
