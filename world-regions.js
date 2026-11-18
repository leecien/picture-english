/* Data-backed elemental regions. No DOM, grading or storage writes; RPG owns effects and persistence. */
const WorldRegions = (() => {
  const CATALOG = {
  "schemaVersion": 1,
  "regions": [
    {
      "id": "water",
      "atlasId": "water",
      "name": "水之療癒鎮",
      "icon": "💧",
      "region": "water",
      "route": "daily",
      "layout": [
        "TTTTTTTTTTTTTTTTTTTTTTTT",
        "T......................T",
        "T.HHHHH..~~~~~..HHHHH..T",
        "T.HHHHH..~~~~~..HHHHH..T",
        "T...a....~~~~~....d....T",
        "T...=.............=....T",
        "T...=m....m.......m....T",
        "T...=.............=....T",
        "T@=P===================T",
        "T...........=..........T",
        "T.....B.....=.m.....B..T",
        "T...........=.HHHH.....T",
        "T...........=.HHHH.....T",
        "T.....mR....c.......m..T",
        "T......................T",
        "TTTTTTTTTTTTTTTTTTTTTTTT"
      ],
      "npcs": [
        {
          "ch": "a",
          "id": "water-guide",
          "name": "Iris・接待員",
          "look": {
            "skin": "#ffe0c7",
            "hair": "#344c6d",
            "cloth": "#f1f5eb",
            "accent": "#73b9bc",
            "boots": "#6b4a3a"
          },
          "questId": "water-1"
        },
        {
          "ch": "d",
          "id": "water-helper",
          "name": "Neri・服務夥伴",
          "look": {
            "skin": "#ffe0c7",
            "hair": "#8c6249",
            "cloth": "#8fb8ac",
            "accent": "#fff1bd",
            "boots": "#6b4a3a"
          },
          "questId": "water-2"
        },
        {
          "ch": "c",
          "id": "water-keeper",
          "name": "Mira・庭院守望者",
          "look": {
            "skin": "#ffe0c7",
            "hair": "#747a9f",
            "cloth": "#a0a8d2",
            "accent": "#d2eeef",
            "boots": "#6b4a3a"
          },
          "questId": "water-3"
        }
      ],
      "mobs": [
        {
          "name": "露光靈",
          "shape": "bubble",
          "hp": 28,
          "atk": 3,
          "colors": [
            "#a2d9e7",
            "#ffffff"
          ],
          "lv": 2,
          "aggressive": false,
          "kind": "scene",
          "intents": [
            "attack"
          ]
        },
        {
          "name": "潮羽雀",
          "shape": "bird",
          "hp": 46,
          "atk": 4,
          "colors": [
            "#b7e3ef",
            "#699cb5"
          ],
          "lv": 3,
          "aggressive": false,
          "kind": "scene",
          "intents": [
            "attack",
            "charge"
          ]
        },
        {
          "name": "苔甲龜",
          "shape": "turtle",
          "hp": 72,
          "atk": 5,
          "colors": [
            "#8dacac",
            "#5a7775"
          ],
          "lv": 4,
          "aggressive": false,
          "kind": "scene",
          "intents": [
            "guard",
            "attack"
          ]
        },
        {
          "name": "潮光精靈",
          "shape": "wisp",
          "hp": 58,
          "atk": 4,
          "lv": 4,
          "colors": [
            "#b1e9eb",
            "#5f9fbe"
          ],
          "aggressive": false,
          "kind": "scene",
          "intents": [
            "attack",
            "drain",
            "attack"
          ]
        },
        {
          "name": "露甲晶蟲",
          "shape": "beetle",
          "hp": 90,
          "atk": 5,
          "lv": 5,
          "colors": [
            "#9bc9bc",
            "#507d8b"
          ],
          "aggressive": false,
          "kind": "scene",
          "intents": [
            "attack",
            "mend",
            "guard"
          ]
        }
      ],
      "boss": {
        "name": "澄波守衛",
        "shape": "guardian",
        "hp": 120,
        "atk": 5,
        "colors": [
          "#c6eef1",
          "#6faaa8"
        ],
        "lv": 5,
        "aggressive": false,
        "kind": "scene",
        "intents": [
          "attack",
          "attack",
          "charge"
        ],
        "boss": true
      },
      "quests": [
        {
          "id": "water-1",
          "npcId": "water-guide",
          "title": "說清楚身體的訊息",
          "order": 1,
          "introEn": "How can I help you today?",
          "introZh": "Iris 正在重新整理診所指引。先練習說出不舒服的地方，讓來訪的人知道怎麼求助。",
          "finishEn": "Now I know how you feel.",
          "finishZh": "你幫 Iris 完成了第一張服務指引。下一步找 Neri，練習在藥局詢問需求。",
          "questionRefs": [
            {
              "cat": "life",
              "scene": "doctor",
              "index": 0,
              "mode": "meaning"
            },
            {
              "cat": "life",
              "scene": "doctor",
              "index": 1,
              "mode": "meaning"
            },
            {
              "cat": "life",
              "scene": "doctor",
              "index": 2,
              "mode": "meaning"
            },
            {
              "cat": "life",
              "scene": "doctor",
              "index": 3,
              "mode": "meaning"
            },
            {
              "cat": "life",
              "scene": "doctor",
              "index": 4,
              "mode": "meaning"
            }
          ],
          "requiredCorrect": 4,
          "battleRequired": false,
          "boss": null,
          "reward": {
            "id": "regions:water-1:first",
            "xp": 24,
            "items": {
              "berry": 1
            },
            "seal": null
          }
        },
        {
          "id": "water-2",
          "npcId": "water-helper",
          "title": "找到對的服務窗口",
          "order": 2,
          "introEn": "Please ask before you take anything.",
          "introZh": "Neri 想把藥局常用問句整理成清楚的卡片。請練習詢問需求與確認資訊。",
          "finishEn": "Thank you for asking clearly.",
          "finishZh": "詢問卡片已備妥。到庭院找 Mira，準備把關心的話帶給居民。",
          "questionRefs": [
            {
              "cat": "life",
              "scene": "pharmacy",
              "index": 0,
              "mode": "meaning"
            },
            {
              "cat": "life",
              "scene": "pharmacy",
              "index": 1,
              "mode": "meaning"
            },
            {
              "cat": "life",
              "scene": "pharmacy",
              "index": 2,
              "mode": "meaning"
            },
            {
              "cat": "life",
              "scene": "pharmacy",
              "index": 3,
              "mode": "meaning"
            },
            {
              "cat": "life",
              "scene": "pharmacy",
              "index": 4,
              "mode": "meaning"
            }
          ],
          "requiredCorrect": 4,
          "battleRequired": false,
          "boss": null,
          "reward": {
            "id": "regions:water-2:first",
            "xp": 28,
            "items": {
              "dew": 1
            },
            "seal": null
          }
        },
        {
          "id": "water-3",
          "npcId": "water-keeper",
          "title": "讓關心傳出去",
          "order": 3,
          "introEn": "A kind word can help.",
          "introZh": "Mira 守著最後一盞庭院燈。先練習表達關心，再和澄波守衛完成共鳴試煉。",
          "finishEn": "The courtyard lights are shining again.",
          "finishZh": "庭院的燈重新亮起。居民有了清楚的求助指引，也聽見彼此的關心。",
          "questionRefs": [
            {
              "cat": "social",
              "scene": "feelings",
              "index": 0,
              "mode": "meaning"
            },
            {
              "cat": "social",
              "scene": "feelings",
              "index": 1,
              "mode": "meaning"
            },
            {
              "cat": "social",
              "scene": "feelings",
              "index": 2,
              "mode": "meaning"
            },
            {
              "cat": "social",
              "scene": "feelings",
              "index": 3,
              "mode": "meaning"
            },
            {
              "cat": "social",
              "scene": "feelings",
              "index": 4,
              "mode": "meaning"
            }
          ],
          "requiredCorrect": 4,
          "battleRequired": true,
          "boss": {
            "name": "澄波守衛",
            "shape": "guardian",
            "hp": 120,
            "atk": 5,
            "colors": [
              "#c6eef1",
              "#6faaa8"
            ],
            "lv": 5,
            "aggressive": false,
            "kind": "scene",
            "intents": [
              "attack",
              "attack",
              "charge"
            ],
            "boss": true
          },
          "reward": {
            "id": "regions:water-3:first",
            "xp": 45,
            "items": {
              "berry": 1,
              "dew": 1
            },
            "seal": {
              "id": "water",
              "name": "水之印記"
            }
          }
        }
      ],
      "palette": {
        "grass": "#b9e3df",
        "grass2": "#b9e3df",
        "blade": "#6baeb2",
        "path": "#e8dcc0",
        "pathDot": "#cbbf9f",
        "tree": [
          "#6baeb2",
          "#95cad0"
        ],
        "flower": [
          "#ffffff",
          "#e8bfd0",
          "#e9da9f"
        ],
        "roof": [
          "#86b6c8",
          "#af9cce"
        ],
        "edge": "#95cad0",
        "water": "#92cbdc",
        "berry": "#9f93ba"
      },
      "ending": {
        "title": "水之療癒鎮的共鳴印記",
        "en": "The courtyard lights are shining again.",
        "zh": "庭院的燈重新亮起。居民有了清楚的求助指引，也聽見彼此的關心。"
      },
      "entryHint": "地圖入口沿用冒險的解鎖狀態；三段居民任務依序開放。"
    },
    {
      "id": "light",
      "atlasId": "light",
      "name": "光之學園",
      "icon": "📖",
      "region": "light",
      "route": "daily",
      "layout": [
        "TTTTTTTTTTTTTTTTTTTTTTTT",
        "T......................T",
        "T.......HHHHHHHH.......T",
        "T.......HHHHHHHH.......T",
        "T..........a...........T",
        "T..B...TT..=....TT..B..T",
        "T....m.TT.m=....TTm....T",
        "T..........=...........T",
        "T@=P===================T",
        "T...=..............=...T",
        "T.HH=HH.......m..HH=HH.T",
        "T.HH=HH..........HH=HH.T",
        "T...d..............c...T",
        "T.....m....R........m..T",
        "T......................T",
        "TTTTTTTTTTTTTTTTTTTTTTTT"
      ],
      "npcs": [
        {
          "ch": "a",
          "id": "light-guide",
          "name": "Nora・課堂引導員",
          "look": {
            "skin": "#ffe0c7",
            "hair": "#75523d",
            "cloth": "#f2ebd8",
            "accent": "#9b8acb",
            "boots": "#6b4a3a"
          },
          "questId": "light-1"
        },
        {
          "ch": "d",
          "id": "light-helper",
          "name": "Theo・圖書館員",
          "look": {
            "skin": "#ffe0c7",
            "hair": "#405c73",
            "cloth": "#9fb5c3",
            "accent": "#fff0bf",
            "boots": "#6b4a3a"
          },
          "questId": "light-2"
        },
        {
          "ch": "c",
          "id": "light-keeper",
          "name": "Luca・展覽召集人",
          "look": {
            "skin": "#ffe0c7",
            "hair": "#999b8e",
            "cloth": "#d6c58b",
            "accent": "#6d918b",
            "boots": "#6b4a3a"
          },
          "questId": "light-3"
        }
      ],
      "mobs": [
        {
          "name": "紙頁靈",
          "shape": "slime",
          "hp": 30,
          "atk": 3,
          "colors": [
            "#e6ddb7",
            "#a7b98b"
          ],
          "lv": 2,
          "aggressive": false,
          "kind": "scene",
          "intents": [
            "attack"
          ]
        },
        {
          "name": "墨羽雀",
          "shape": "bird",
          "hp": 50,
          "atk": 4,
          "colors": [
            "#a8b9df",
            "#5e7f99"
          ],
          "lv": 3,
          "aggressive": false,
          "kind": "scene",
          "intents": [
            "attack",
            "charge"
          ]
        },
        {
          "name": "書岩龜",
          "shape": "turtle",
          "hp": 78,
          "atk": 5,
          "colors": [
            "#c5bea5",
            "#8d9275"
          ],
          "lv": 4,
          "aggressive": false,
          "kind": "scene",
          "intents": [
            "guard",
            "attack"
          ]
        },
        {
          "name": "晨曦靈",
          "shape": "wisp",
          "hp": 64,
          "atk": 4,
          "lv": 4,
          "colors": [
            "#fff1bd",
            "#bbaa79"
          ],
          "aggressive": false,
          "kind": "scene",
          "intents": [
            "attack",
            "drain",
            "attack"
          ]
        },
        {
          "name": "琥珀甲蟲",
          "shape": "beetle",
          "hp": 96,
          "atk": 5,
          "lv": 5,
          "colors": [
            "#cfc991",
            "#7b9875"
          ],
          "aggressive": false,
          "kind": "scene",
          "intents": [
            "attack",
            "mend",
            "guard"
          ]
        }
      ],
      "boss": {
        "name": "晨光守衛",
        "shape": "guardian",
        "hp": 130,
        "atk": 5,
        "colors": [
          "#fff0c3",
          "#a9b797"
        ],
        "lv": 5,
        "aggressive": false,
        "kind": "scene",
        "intents": [
          "attack",
          "attack",
          "charge"
        ],
        "boss": true
      },
      "quests": [
        {
          "id": "light-1",
          "npcId": "light-guide",
          "title": "把問題問出來",
          "order": 1,
          "introEn": "Questions help us learn.",
          "introZh": "Nora 邀你一起把課堂變成敢開口的地方。先練習提問、請對方重說與確認意思。",
          "finishEn": "Your questions are clear.",
          "finishZh": "提問手帳完成了。去找 Theo，借一份展覽需要的資料。",
          "questionRefs": [
            {
              "cat": "school",
              "scene": "class",
              "index": 0,
              "mode": "meaning"
            },
            {
              "cat": "school",
              "scene": "class",
              "index": 1,
              "mode": "meaning"
            },
            {
              "cat": "school",
              "scene": "class",
              "index": 2,
              "mode": "meaning"
            },
            {
              "cat": "school",
              "scene": "class",
              "index": 3,
              "mode": "meaning"
            },
            {
              "cat": "school",
              "scene": "class",
              "index": 4,
              "mode": "meaning"
            }
          ],
          "requiredCorrect": 4,
          "battleRequired": false,
          "boss": null,
          "reward": {
            "id": "regions:light-1:first",
            "xp": 24,
            "items": {
              "berry": 1
            },
            "seal": null
          }
        },
        {
          "id": "light-2",
          "npcId": "light-helper",
          "title": "書頁裡的線索",
          "order": 2,
          "introEn": "Let us find the right book.",
          "introZh": "Theo 正在準備學園展覽。用英文詢問書的位置、借閱與續借方式。",
          "finishEn": "You found what we need.",
          "finishZh": "資料找齊了。到展示台找 Luca，一起安排合作的下一步。",
          "questionRefs": [
            {
              "cat": "school",
              "scene": "library",
              "index": 0,
              "mode": "meaning"
            },
            {
              "cat": "school",
              "scene": "library",
              "index": 1,
              "mode": "meaning"
            },
            {
              "cat": "school",
              "scene": "library",
              "index": 2,
              "mode": "meaning"
            },
            {
              "cat": "school",
              "scene": "library",
              "index": 3,
              "mode": "meaning"
            },
            {
              "cat": "school",
              "scene": "library",
              "index": 4,
              "mode": "meaning"
            }
          ],
          "requiredCorrect": 4,
          "battleRequired": false,
          "boss": null,
          "reward": {
            "id": "regions:light-2:first",
            "xp": 28,
            "items": {
              "dew": 1
            },
            "seal": null
          }
        },
        {
          "id": "light-3",
          "npcId": "light-keeper",
          "title": "一起完成展覽",
          "order": 3,
          "introEn": "We can build this together.",
          "introZh": "Luca 需要大家分工。先練習合作句子，再和晨光守衛測試展覽的共鳴裝置。",
          "finishEn": "Our exhibition is ready.",
          "finishZh": "展覽正式開門。你的提問、資料和合作讓每位來訪者都能找到新的理解。",
          "questionRefs": [
            {
              "cat": "school",
              "scene": "group",
              "index": 0,
              "mode": "meaning"
            },
            {
              "cat": "school",
              "scene": "group",
              "index": 1,
              "mode": "meaning"
            },
            {
              "cat": "school",
              "scene": "group",
              "index": 2,
              "mode": "meaning"
            },
            {
              "cat": "school",
              "scene": "group",
              "index": 3,
              "mode": "meaning"
            },
            {
              "cat": "school",
              "scene": "group",
              "index": 4,
              "mode": "meaning"
            }
          ],
          "requiredCorrect": 4,
          "battleRequired": true,
          "boss": {
            "name": "晨光守衛",
            "shape": "guardian",
            "hp": 130,
            "atk": 5,
            "colors": [
              "#fff0c3",
              "#a9b797"
            ],
            "lv": 5,
            "aggressive": false,
            "kind": "scene",
            "intents": [
              "attack",
              "attack",
              "charge"
            ],
            "boss": true
          },
          "reward": {
            "id": "regions:light-3:first",
            "xp": 45,
            "items": {
              "berry": 1,
              "dew": 1
            },
            "seal": {
              "id": "light",
              "name": "光之印記"
            }
          }
        }
      ],
      "palette": {
        "grass": "#dce4bc",
        "grass2": "#dce4bc",
        "blade": "#9ebd76",
        "path": "#e8dcc0",
        "pathDot": "#cbbf9f",
        "tree": [
          "#9ebd76",
          "#c7d79d"
        ],
        "flower": [
          "#ffffff",
          "#e8bfd0",
          "#e9da9f"
        ],
        "roof": [
          "#c8b777",
          "#b9bfdf"
        ],
        "edge": "#c7d79d",
        "water": "#92cbdc",
        "berry": "#9f93ba"
      },
      "ending": {
        "title": "光之學園的共鳴印記",
        "en": "Our exhibition is ready.",
        "zh": "展覽正式開門。你的提問、資料和合作讓每位來訪者都能找到新的理解。"
      },
      "entryHint": "地圖入口沿用冒險的解鎖狀態；三段居民任務依序開放。"
    },
    {
      "id": "metal",
      "atlasId": "metal",
      "name": "金之商務都會",
      "icon": "🏙️",
      "region": "metal",
      "route": "daily",
      "layout": [
        "TTTTTTTTTTTTTTTTTTTTTTTT",
        "T......................T",
        "T.HHHHHF.........HHHHH.T",
        "T.HHHHHF.........HHHHH.T",
        "T...a..F...........d...T",
        "T...=..F......B....=...T",
        "T...=m.F..m.......m=...T",
        "T...=..............=...T",
        "T@=P===================T",
        "T...........=..........T",
        "T........HHH=HH.F......T",
        "T..R.....HHH=HH.F...R..T",
        "T...........c...F......T",
        "T.....m.........F...m..T",
        "T......................T",
        "TTTTTTTTTTTTTTTTTTTTTTTT"
      ],
      "npcs": [
        {
          "ch": "a",
          "id": "metal-guide",
          "name": "Rowan・團隊接待員",
          "look": {
            "skin": "#ffe0c7",
            "hair": "#3d4b56",
            "cloth": "#849fb9",
            "accent": "#e6d3a0",
            "boots": "#6b4a3a"
          },
          "questId": "metal-1"
        },
        {
          "ch": "d",
          "id": "metal-helper",
          "name": "June・會議協調員",
          "look": {
            "skin": "#ffe0c7",
            "hair": "#845b47",
            "cloth": "#e6e8e0",
            "accent": "#5f8c9d",
            "boots": "#6b4a3a"
          },
          "questId": "metal-2"
        },
        {
          "ch": "c",
          "id": "metal-keeper",
          "name": "Arden・專案守望者",
          "look": {
            "skin": "#ffe0c7",
            "hair": "#667281",
            "cloth": "#9aadc0",
            "accent": "#d9b87f",
            "boots": "#6b4a3a"
          },
          "questId": "metal-3"
        }
      ],
      "mobs": [
        {
          "name": "磁光靈",
          "shape": "slime",
          "hp": 34,
          "atk": 3,
          "colors": [
            "#b8d8d0",
            "#608a82"
          ],
          "lv": 2,
          "aggressive": false,
          "kind": "scene",
          "intents": [
            "attack"
          ]
        },
        {
          "name": "訊羽雀",
          "shape": "bird",
          "hp": 56,
          "atk": 4,
          "colors": [
            "#b8ccdf",
            "#6785a1"
          ],
          "lv": 3,
          "aggressive": false,
          "kind": "scene",
          "intents": [
            "attack",
            "charge"
          ]
        },
        {
          "name": "鐵甲龜",
          "shape": "turtle",
          "hp": 84,
          "atk": 5,
          "colors": [
            "#b2bbc2",
            "#667984"
          ],
          "lv": 4,
          "aggressive": false,
          "kind": "scene",
          "intents": [
            "guard",
            "attack"
          ]
        },
        {
          "name": "電弧靈",
          "shape": "wisp",
          "hp": 68,
          "atk": 5,
          "lv": 4,
          "colors": [
            "#c8e9f3",
            "#7c9fbe"
          ],
          "aggressive": false,
          "kind": "scene",
          "intents": [
            "attack",
            "drain",
            "attack"
          ]
        },
        {
          "name": "磁甲蟲",
          "shape": "beetle",
          "hp": 104,
          "atk": 6,
          "lv": 5,
          "colors": [
            "#aebccf",
            "#61798e"
          ],
          "aggressive": false,
          "kind": "scene",
          "intents": [
            "attack",
            "mend",
            "guard"
          ]
        }
      ],
      "boss": {
        "name": "秩序守衛",
        "shape": "guardian",
        "hp": 140,
        "atk": 6,
        "colors": [
          "#d9e6ee",
          "#8499ad"
        ],
        "lv": 6,
        "aggressive": false,
        "kind": "scene",
        "intents": [
          "attack",
          "attack",
          "charge"
        ],
        "boss": true
      },
      "quests": [
        {
          "id": "metal-1",
          "npcId": "metal-guide",
          "title": "第一次加入團隊",
          "order": 1,
          "introEn": "Welcome to the team.",
          "introZh": "Rowan 歡迎你參加合作日。先介紹自己的工作，確認大家的角色與責任。",
          "finishEn": "It is good to know your team.",
          "finishZh": "團隊名牌準備好了。找 June，把會議中的重點說清楚。",
          "questionRefs": [
            {
              "cat": "work",
              "scene": "intro",
              "index": 0,
              "mode": "meaning"
            },
            {
              "cat": "work",
              "scene": "intro",
              "index": 1,
              "mode": "meaning"
            },
            {
              "cat": "work",
              "scene": "intro",
              "index": 2,
              "mode": "meaning"
            },
            {
              "cat": "work",
              "scene": "intro",
              "index": 3,
              "mode": "meaning"
            },
            {
              "cat": "work",
              "scene": "intro",
              "index": 4,
              "mode": "meaning"
            }
          ],
          "requiredCorrect": 4,
          "battleRequired": false,
          "boss": null,
          "reward": {
            "id": "regions:metal-1:first",
            "xp": 24,
            "items": {
              "berry": 1
            },
            "seal": null
          }
        },
        {
          "id": "metal-2",
          "npcId": "metal-helper",
          "title": "接上沒有送達的訊息",
          "order": 2,
          "introEn": "Let us make sure everyone understands.",
          "introZh": "June 發現會議有些訊息沒有傳清楚。練習開始、重說、分享與表達意見。",
          "finishEn": "Now we are on the same page.",
          "finishZh": "會議重新接上節奏。請找 Arden，協調最後的合作時間。",
          "questionRefs": [
            {
              "cat": "work",
              "scene": "meeting",
              "index": 0,
              "mode": "meaning"
            },
            {
              "cat": "work",
              "scene": "meeting",
              "index": 1,
              "mode": "meaning"
            },
            {
              "cat": "work",
              "scene": "meeting",
              "index": 2,
              "mode": "meaning"
            },
            {
              "cat": "work",
              "scene": "meeting",
              "index": 3,
              "mode": "meaning"
            },
            {
              "cat": "work",
              "scene": "meeting",
              "index": 4,
              "mode": "meaning"
            }
          ],
          "requiredCorrect": 4,
          "battleRequired": false,
          "boss": null,
          "reward": {
            "id": "regions:metal-2:first",
            "xp": 28,
            "items": {
              "dew": 1
            },
            "seal": null
          }
        },
        {
          "id": "metal-3",
          "npcId": "metal-keeper",
          "title": "讓合作繼續前進",
          "order": 3,
          "introEn": "A clear plan keeps us moving.",
          "introZh": "Arden 等你確認行程。先練習約時間與傳送資訊，再完成秩序守衛的專案試煉。",
          "finishEn": "The cooperation day can begin.",
          "finishZh": "合作日順利開始。明確的介紹、會議與行程讓城市的消息重新流動。",
          "questionRefs": [
            {
              "cat": "work",
              "scene": "schedule",
              "index": 0,
              "mode": "meaning"
            },
            {
              "cat": "work",
              "scene": "schedule",
              "index": 1,
              "mode": "meaning"
            },
            {
              "cat": "work",
              "scene": "schedule",
              "index": 2,
              "mode": "meaning"
            },
            {
              "cat": "work",
              "scene": "schedule",
              "index": 3,
              "mode": "meaning"
            },
            {
              "cat": "work",
              "scene": "schedule",
              "index": 4,
              "mode": "meaning"
            }
          ],
          "requiredCorrect": 4,
          "battleRequired": true,
          "boss": {
            "name": "秩序守衛",
            "shape": "guardian",
            "hp": 140,
            "atk": 6,
            "colors": [
              "#d9e6ee",
              "#8499ad"
            ],
            "lv": 6,
            "aggressive": false,
            "kind": "scene",
            "intents": [
              "attack",
              "attack",
              "charge"
            ],
            "boss": true
          },
          "reward": {
            "id": "regions:metal-3:first",
            "xp": 45,
            "items": {
              "berry": 1,
              "dew": 1
            },
            "seal": {
              "id": "metal",
              "name": "金之印記"
            }
          }
        }
      ],
      "palette": {
        "grass": "#cadbdc",
        "grass2": "#cadbdc",
        "blade": "#86b2a4",
        "path": "#e8dcc0",
        "pathDot": "#cbbf9f",
        "tree": [
          "#86b2a4",
          "#aac8bb"
        ],
        "flower": [
          "#ffffff",
          "#e8bfd0",
          "#e9da9f"
        ],
        "roof": [
          "#7d9db7",
          "#c1b08a"
        ],
        "edge": "#aac8bb",
        "water": "#92cbdc",
        "berry": "#9f93ba"
      },
      "ending": {
        "title": "金之商務都會的共鳴印記",
        "en": "The cooperation day can begin.",
        "zh": "合作日順利開始。明確的介紹、會議與行程讓城市的消息重新流動。"
      },
      "entryHint": "地圖入口沿用冒險的解鎖狀態；三段居民任務依序開放。"
    },
    {
      "id": "star",
      "atlasId": "star",
      "name": "星之文化樂園",
      "icon": "🎨",
      "region": "star",
      "route": "daily",
      "layout": [
        "TTTTTTTTTTTTTTTTTTTTTTTT",
        "T......................T",
        "T.HHHHH.........HHHHH..T",
        "T.HHHHH.........HHHHH..T",
        "T...a.....~~~~....c....T",
        "T...=....======...=....T",
        "T...=m....~~~~....m....T",
        "T...=.............=....T",
        "T@=P===================T",
        "T........=.............T",
        "T........=....m........T",
        "T.....B..=.............T",
        "T........d...R..B......T",
        "T.....m.............m..T",
        "T......................T",
        "TTTTTTTTTTTTTTTTTTTTTTTT"
      ],
      "npcs": [
        {
          "ch": "a",
          "id": "star-guide",
          "name": "Vega・興趣嚮導",
          "look": {
            "skin": "#ffe0c7",
            "hair": "#7d6d95",
            "cloth": "#b5a4cc",
            "accent": "#f2dfac",
            "boots": "#6b4a3a"
          },
          "questId": "star-1"
        },
        {
          "ch": "d",
          "id": "star-helper",
          "name": "Ari・活動夥伴",
          "look": {
            "skin": "#ffe0c7",
            "hair": "#4b6d8a",
            "cloth": "#97c4c9",
            "accent": "#fff0c7",
            "boots": "#6b4a3a"
          },
          "questId": "star-2"
        },
        {
          "ch": "c",
          "id": "star-keeper",
          "name": "Nox・文化日召集人",
          "look": {
            "skin": "#ffe0c7",
            "hair": "#84869b",
            "cloth": "#d0b1c4",
            "accent": "#9bafd0",
            "boots": "#6b4a3a"
          },
          "questId": "star-3"
        }
      ],
      "mobs": [
        {
          "name": "星塵靈",
          "shape": "bubble",
          "hp": 32,
          "atk": 3,
          "colors": [
            "#d8c6ee",
            "#ffffff"
          ],
          "lv": 2,
          "aggressive": false,
          "kind": "scene",
          "intents": [
            "attack"
          ]
        },
        {
          "name": "夜羽雀",
          "shape": "bird",
          "hp": 54,
          "atk": 4,
          "colors": [
            "#c8d6ef",
            "#888eaf"
          ],
          "lv": 3,
          "aggressive": false,
          "kind": "scene",
          "intents": [
            "attack",
            "charge"
          ]
        },
        {
          "name": "月岩龜",
          "shape": "turtle",
          "hp": 82,
          "atk": 5,
          "colors": [
            "#bdb8ce",
            "#85869c"
          ],
          "lv": 4,
          "aggressive": false,
          "kind": "scene",
          "intents": [
            "guard",
            "attack"
          ]
        },
        {
          "name": "星芒靈",
          "shape": "wisp",
          "hp": 66,
          "atk": 4,
          "lv": 4,
          "colors": [
            "#e9d6f5",
            "#a48ccc"
          ],
          "aggressive": false,
          "kind": "scene",
          "intents": [
            "attack",
            "drain",
            "attack"
          ]
        },
        {
          "name": "月紋甲蟲",
          "shape": "beetle",
          "hp": 100,
          "atk": 5,
          "lv": 5,
          "colors": [
            "#c6c2e7",
            "#827ca7"
          ],
          "aggressive": false,
          "kind": "scene",
          "intents": [
            "attack",
            "mend",
            "guard"
          ]
        }
      ],
      "boss": {
        "name": "星穹守衛",
        "shape": "guardian",
        "hp": 135,
        "atk": 5,
        "colors": [
          "#eadff6",
          "#a19dc4"
        ],
        "lv": 6,
        "aggressive": false,
        "kind": "scene",
        "intents": [
          "attack",
          "attack",
          "charge"
        ],
        "boss": true
      },
      "quests": [
        {
          "id": "star-1",
          "npcId": "star-guide",
          "title": "找到共同的喜歡",
          "order": 1,
          "introEn": "Tell me what you enjoy.",
          "introZh": "Vega 正在收集文化日的活動點子。聊聊興趣、天氣與休閒，找到共同的話題。",
          "finishEn": "We have so much to share.",
          "finishZh": "活動點子越來越多。找 Ari，把邀請和集合資訊說清楚。",
          "questionRefs": [
            {
              "cat": "social",
              "scene": "hobbies",
              "index": 0,
              "mode": "meaning"
            },
            {
              "cat": "social",
              "scene": "hobbies",
              "index": 1,
              "mode": "meaning"
            },
            {
              "cat": "social",
              "scene": "hobbies",
              "index": 2,
              "mode": "meaning"
            },
            {
              "cat": "social",
              "scene": "hobbies",
              "index": 3,
              "mode": "meaning"
            },
            {
              "cat": "social",
              "scene": "hobbies",
              "index": 4,
              "mode": "meaning"
            }
          ],
          "requiredCorrect": 4,
          "battleRequired": false,
          "boss": null,
          "reward": {
            "id": "regions:star-1:first",
            "xp": 24,
            "items": {
              "berry": 1
            },
            "seal": null
          }
        },
        {
          "id": "star-2",
          "npcId": "star-helper",
          "title": "把邀請送到手上",
          "order": 2,
          "introEn": "Would you like to join us?",
          "introZh": "Ari 要邀朋友來文化日。確認時間、活動與地點，讓邀請真的能成行。",
          "finishEn": "See you at the festival.",
          "finishZh": "邀請已經送達。找 Nox，準備文化日的最後一段交流。",
          "questionRefs": [
            {
              "cat": "social",
              "scene": "invite",
              "index": 0,
              "mode": "meaning"
            },
            {
              "cat": "social",
              "scene": "invite",
              "index": 1,
              "mode": "meaning"
            },
            {
              "cat": "social",
              "scene": "invite",
              "index": 2,
              "mode": "meaning"
            },
            {
              "cat": "social",
              "scene": "invite",
              "index": 3,
              "mode": "meaning"
            },
            {
              "cat": "social",
              "scene": "invite",
              "index": 4,
              "mode": "meaning"
            }
          ],
          "requiredCorrect": 4,
          "battleRequired": false,
          "boss": null,
          "reward": {
            "id": "regions:star-2:first",
            "xp": 28,
            "items": {
              "dew": 1
            },
            "seal": null
          }
        },
        {
          "id": "star-3",
          "npcId": "star-keeper",
          "title": "星光下的文化日",
          "order": 3,
          "introEn": "Let us celebrate together.",
          "introZh": "Nox 邀你練習聚會裡的禮貌交流，再和星穹守衛一起點亮文化日舞台。",
          "finishEn": "The stars are shining for everyone.",
          "finishZh": "文化日的燈亮起。不同興趣與故事在這裡相遇，你也找到可以一起分享生活的朋友。",
          "questionRefs": [
            {
              "cat": "social",
              "scene": "party",
              "index": 0,
              "mode": "meaning"
            },
            {
              "cat": "social",
              "scene": "party",
              "index": 1,
              "mode": "meaning"
            },
            {
              "cat": "social",
              "scene": "party",
              "index": 2,
              "mode": "meaning"
            },
            {
              "cat": "social",
              "scene": "party",
              "index": 3,
              "mode": "meaning"
            },
            {
              "cat": "social",
              "scene": "party",
              "index": 4,
              "mode": "meaning"
            }
          ],
          "requiredCorrect": 4,
          "battleRequired": true,
          "boss": {
            "name": "星穹守衛",
            "shape": "guardian",
            "hp": 135,
            "atk": 5,
            "colors": [
              "#eadff6",
              "#a19dc4"
            ],
            "lv": 6,
            "aggressive": false,
            "kind": "scene",
            "intents": [
              "attack",
              "attack",
              "charge"
            ],
            "boss": true
          },
          "reward": {
            "id": "regions:star-3:first",
            "xp": 45,
            "items": {
              "berry": 1,
              "dew": 1
            },
            "seal": {
              "id": "star",
              "name": "星之印記"
            }
          }
        }
      ],
      "palette": {
        "grass": "#d9d9e9",
        "grass2": "#d9d9e9",
        "blade": "#9fb6c8",
        "path": "#e8dcc0",
        "pathDot": "#cbbf9f",
        "tree": [
          "#9fb6c8",
          "#bcc7dc"
        ],
        "flower": [
          "#ffffff",
          "#e8bfd0",
          "#e9da9f"
        ],
        "roof": [
          "#9d91bd",
          "#e1ae9b"
        ],
        "edge": "#bcc7dc",
        "water": "#92cbdc",
        "berry": "#9f93ba"
      },
      "ending": {
        "title": "星之文化樂園的共鳴印記",
        "en": "The stars are shining for everyone.",
        "zh": "文化日的燈亮起。不同興趣與故事在這裡相遇，你也找到可以一起分享生活的朋友。"
      },
      "entryHint": "地圖入口沿用冒險的解鎖狀態；三段居民任務依序開放。"
    }
  ],
  "questionPolicy": "existing-scene-meaning-cue",
  "stateVersion": 1
};
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const regions = new Map(CATALOG.regions.map((r) => [r.id, r]));
  function has(id) { return regions.has(id); }
  function map(id) { return maps.find((r) => r.id === id) || null; }
  const maps = CATALOG.regions.map((r) => {
    // Follow the exact marker scan order used by World.mount. This also stays stable on respawn.
    const spawns = r.layout.flatMap((row,y) => [...row].flatMap((ch,x) => ch === 'm' ? [`${x},${y}`] : []));
    return {
      ...clone(r), mob: clone(r.mobs[0]),
      mobAt(p) {
        const index = spawns.indexOf(`${p.x},${p.y}`);
        return index < 0 ? null : clone(r.mobs[index % r.mobs.length]);
      },
    };
  });
  function validRun(run, quest) {
    if (!run || run.questId !== quest.id || !Array.isArray(run.answers) || run.answers.length > quest.questionRefs.length || run.index !== run.answers.length) return false;
    return run.answers.every((a, i) => a && a.index === i && typeof a.correct === 'boolean' && typeof a.assisted === 'boolean');
  }
  function fresh() { return {version:1, completed:{}, claimed:{}, runs:{}, history:{}, seals:{}}; }
  function normalize(raw) {
    const state = fresh(), source = raw && typeof raw === 'object' ? raw : {};
    for (const r of CATALOG.regions) {
      const done = Array.isArray(source.completed?.[r.id]) ? source.completed[r.id] : [];
      state.completed[r.id] = [];
      for (const q of r.quests) {
        if (!done.includes(q.id)) break;
        state.completed[r.id].push(q.id);
        // Completion also implies this reward is already consumed. A migrated save must never re-award it.
        state.claimed[q.reward.id] = true;
        if (q.reward.seal) state.seals[q.reward.seal.id] = clone(q.reward.seal);
      }
      for (const q of r.quests) {
        if (source.claimed?.[q.reward.id] === true) state.claimed[q.reward.id] = true;
        const h = source.history?.[q.id];
        if (h && typeof h === 'object') state.history[q.id] = {
          attempts:Math.max(0, Math.min(100000, Number.isSafeInteger(h.attempts) ? h.attempts : 0)),
          passed:!!h.passed,
        };
      }
      const q = r.quests[state.completed[r.id].length];
      const run = source.runs?.[r.id];
      if (q && validRun(run, q)) state.runs[r.id] = {
        questId:q.id,index:run.answers.length,answers:clone(run.answers),
        battleWon:run.battleWon === true,
        battleAttempts:Number.isSafeInteger(run.battleAttempts) && run.battleAttempts > 0 ? run.battleAttempts : 0,
      };
    }
    return state;
  }
  function next(id, raw) {
    const r = regions.get(id); if (!r) return null;
    return clone(r.quests[normalize(raw).completed[id].length] || null);
  }
  function resultOf(q, run) {
    const total = q.questionRefs.length, answered = run.answers.length;
    const independent = run.answers.filter((a) => a.correct && !a.assisted).length;
    const assisted = run.answers.filter((a) => a.assisted).length;
    const correct = run.answers.filter((a) => a.correct).length;
    return {total,answered,correct,independent,assisted,wrong:answered-correct,
      finished:answered === total,passed:answered === total && independent >= q.requiredCorrect,
      battleRequired:q.battleRequired,battleWon:run.battleWon === true};
  }
  function status(id, raw) {
    const r = regions.get(id); if (!r) return {id,unlocked:false,reason:'unknown-map',next:null};
    const state = normalize(raw), q = r.quests[state.completed[id].length] || null;
    const run = state.runs[id] || null, result = q && run ? resultOf(q, run) : null;
    return {id,name:r.name,unlocked:true,done:!q,total:r.quests.length,
      completedCount:state.completed[id].length,completedQuestIds:state.completed[id].slice(),
      next:q ? clone(q) : null,active:run ? clone(run) : null,result,
      rewardReady:!!(result?.passed && (!q.battleRequired || result.battleWon)),
      seal:state.seals[id] ? clone(state.seals[id]) : null};
  }
  function failure(reason, state, extra = {}) { return {ok:false,reason,state,...extra}; }
  function start(id, raw, questId) {
    const state = normalize(raw), r = regions.get(id);
    if (!r) return failure('unknown-map',state);
    const q = r.quests[state.completed[id].length];
    if (!q) return failure('region-complete',state,{alreadyClaimed:true});
    if (questId && questId !== q.id) return failure(state.completed[id].includes(questId) ? 'already-complete' : 'quest-locked',state);
    const existing = state.runs[id];
    if (existing) return {ok:true,state,quest:clone(q),run:clone(existing),resumed:true};
    const run = {questId:q.id,index:0,answers:[],battleWon:false,battleAttempts:0};
    state.runs[id] = run;
    state.history[q.id] = {attempts:(state.history[q.id]?.attempts || 0)+1,passed:false};
    return {ok:true,state,quest:clone(q),run:clone(run),resumed:false};
  }
  function answer(id, raw, entry) {
    const state = normalize(raw), r = regions.get(id), q = r?.quests[state.completed[id]?.length];
    if (!r) return failure('unknown-map',state);
    const run = state.runs[id];
    if (!q || !run) return failure('no-active-quest',state);
    if (!entry || entry.index !== run.index || run.index >= q.questionRefs.length) return failure('answer-out-of-order',state);
    if (typeof entry.correct !== 'boolean' || (entry.assisted !== undefined && typeof entry.assisted !== 'boolean')) return failure('invalid-answer',state);
    run.answers.push({index:run.index,correct:entry.correct,assisted:entry.assisted === true});
    run.index++;
    const result = resultOf(q,run);
    return {ok:true,state,quest:clone(q),run:clone(run),finished:result.finished,result};
  }
  function recordBattle(id, raw, outcome) {
    const state = normalize(raw), r = regions.get(id), q = r?.quests[state.completed[id]?.length], run = state.runs[id];
    if (!r) return failure('unknown-map',state);
    if (!q || !run) return failure('no-active-quest',state);
    if (!q.battleRequired) return failure('battle-not-required',state);
    if (!resultOf(q,run).passed) return failure('quiz-not-passed',state);
    if (!outcome || typeof outcome.won !== 'boolean') return failure('invalid-battle-result',state);
    run.battleAttempts++;
    run.battleWon = run.battleWon || outcome.won;
    return {ok:true,state,quest:clone(q),run:clone(run),result:resultOf(q,run)};
  }
  function complete(id, raw) {
    const state = normalize(raw), r = regions.get(id);
    if (!r) return failure('unknown-map',state);
    const q = r.quests[state.completed[id].length], run = state.runs[id];
    if (!q) return failure('region-complete',state,{alreadyClaimed:true});
    if (!run) return failure('no-active-quest',state);
    const result = resultOf(q,run);
    if (!result.finished) return failure('quiz-incomplete',state,{result});
    if (!result.passed) {
      delete state.runs[id];
      return failure('quiz-not-passed',state,{result,retry:true});
    }
    if (q.battleRequired && !run.battleWon) return failure('battle-required',state,{result});
    const alreadyClaimed = state.claimed[q.reward.id] === true;
    state.completed[id].push(q.id);
    state.claimed[q.reward.id] = true;
    state.history[q.id] = {...state.history[q.id],passed:true};
    if (q.reward.seal) state.seals[q.reward.seal.id] = clone(q.reward.seal);
    delete state.runs[id];
    return {ok:true,state,quest:clone(q),result,alreadyClaimed,
      reward:alreadyClaimed ? null : clone(q.reward),regionComplete:state.completed[id].length === r.quests.length,
      next:clone(r.quests[state.completed[id].length] || null)};
  }
  function questionRefs(id, questId) {
    const r = regions.get(id); if (!r) return [];
    const q = questId ? r.quests.find((q) => q.id === questId) : r.quests[0];
    return clone(q?.questionRefs || []);
  }
  function question(id, raw, learn) {
    const s = status(id,raw);
    if (!s.active || !s.next || !learn || typeof learn.sceneQuestion !== 'function') return null;
    const ref = s.next.questionRefs[s.active.index];
    if (!ref) return null;
    return learn.sceneQuestion(ref.cat,ref.scene,ref.index,{mode:ref.mode,ctx:`region:${s.next.id}`});
  }
  function validate(catalog = CATALOG, scenes) {
    const errors = [], ids = new Set(), rewardIds = new Set();
    const categories = Array.isArray(scenes) ? scenes : scenes?.categories;
    if (!catalog || !Array.isArray(catalog.regions)) return ['regions must be an array'];
    for (const r of catalog.regions) {
      const fail = (message) => errors.push(`${r.id || '?'}: ${message}`);
      if (!r.id || ids.has(r.id)) fail('duplicate or missing region id'); ids.add(r.id);
      const width = r.layout?.[0]?.length;
      if (!width || !r.layout.every((row) => typeof row === 'string' && row.length === width)) fail('invalid map rows');
      const tiles = (r.layout || []).join('');
      if ([...tiles].filter((c) => c === 'P').length !== 1 || !tiles.includes('@')) fail('map needs one spawn and a portal');
      if (r.mobs?.length !== 5 || new Set((r.mobs || []).map((m) => m.hp)).size !== r.mobs?.length || r.mobs?.some((m) => !(m.hp > 0))) fail('five monsters need different positive HP');
      if ([...tiles].filter((ch) => ch === 'm').length < (r.mobs?.length || 0)) fail('not enough spawn markers for every monster');
      if (new Set((r.mobs || []).map((m) => m.shape)).size !== 5) fail('five distinct monster silhouettes required');
      if (r.quests?.length !== 3) fail('three quests required');
      for (const [index,q] of (r.quests || []).entries()) {
        if (q.order !== index + 1 || q.id !== `${r.id}-${index+1}`) fail('quest order');
        const npc = r.npcs?.find((n) => n.id === q.npcId && n.questId === q.id);
        if (!npc || [...tiles].filter((c) => c === npc.ch).length !== 1) fail(`NPC missing for ${q.id}`);
        if (q.questionRefs?.length < 5 || q.requiredCorrect !== 4) fail(`question threshold ${q.id}`);
        if (q.battleRequired !== (index === 2) || (q.battleRequired && !(q.boss?.hp > 0))) fail(`boss gate ${q.id}`);
        if (!q.reward?.id || rewardIds.has(q.reward.id) || !(q.reward.xp > 0)) fail(`reward ${q.id}`);
        rewardIds.add(q.reward?.id);
        if ((index === 2) !== !!q.reward?.seal) fail(`seal ${q.id}`);
        for (const ref of q.questionRefs || []) {
          if (ref.mode !== 'meaning' || !Number.isInteger(ref.index) || ref.index < 0) fail(`invalid question reference ${q.id}`);
          if (categories) {
            const sc = categories.find((c) => c.id === ref.cat)?.scenes.find((s) => s.id === ref.scene);
            const item = sc?.items?.[ref.index];
            if (!item?.en || !item.zh) fail(`missing scene content ${q.id}/${ref.cat}/${ref.scene}/${ref.index}`);
            else if (new Set(sc.items.map((it) => it.en)).size < 2) fail(`no answer distractors ${q.id}`);
          }
        }
      }
    }
    return errors;
  }
  return {maps,has,map,status,next,start,answer,complete,recordBattle,questionRefs,question,normalize,validate,get catalog(){return clone(CATALOG);}};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = WorldRegions;
