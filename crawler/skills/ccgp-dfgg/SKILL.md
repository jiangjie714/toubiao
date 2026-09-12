# Skill：ccgp-dfgg —— 中国政府采购网（地方单位公告）

## 站点概况

与 `ccgp`（中央单位公告）同一站点、结构完全一致，抓取**地方单位**公告频道 `/cggg/dfgg/`。
详细页面结构、字段说明、反爬注意事项见 `../ccgp/SKILL.md`。

## 频道与类型映射

| 频道 | 路径 | 类型 |
|---|---|---|
| 公开招标公告 | /cggg/dfgg/gkzb/ | NOTICE |
| 中标公告 | /cggg/dfgg/zbgg/ | RESULT |
| 成交公告 | /cggg/dfgg/cjgg/ | RESULT |
| 更正公告 | /cggg/dfgg/gzgg/ | CHANGE |
| 询价公告 | /cggg/dfgg/xjgg/ | INQUIRY |
| 竞争性谈判公告 | /cggg/dfgg/jzxtpgg/ | INQUIRY |
| 竞争性磋商公告 | /cggg/dfgg/jzxcs/ | INQUIRY |

地方频道公告量远大于中央频道，单频道日均可达数百条；如需扩大增量，把各 list 的
`maxPages` 调大（第 2 页 `index_1.htm`、第 3 页 `index_2.htm`…），同时注意保持礼貌抓取间隔。

## 诊断与修复

同 `../ccgp/SKILL.md`。试跑命令：`npm run crawl -- ccgp-dfgg`
