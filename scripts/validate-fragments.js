'use strict';
const {templates}=require('../src/templates');
const {planFragment}=require('../src/code-fragments');
let source='const int USER_LED=8;\nvoid setup(){pinMode(USER_LED,OUTPUT);}\nvoid loop(){digitalWrite(USER_LED,HIGH);}\n';
for(const id of ['Timer','Button','Analog','Button'])source=planFragment(source,id,4,1000).after;
templates.splice(0,templates.length,{id:'FragmentIntegration',title:'片段合并编译验证',parts:'仅编译，不运行硬件',pins:['GPIO4'],libraries:[],outcome:'合并不破坏原工程',body:source});
require('./validate-templates');
