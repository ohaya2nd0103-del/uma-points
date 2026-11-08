// 公式資料で確認した開催事実のみ。更新元: data/races.json
export const catalog = {
  "version": 1,
  "coverage": "2026年第5回東京の確認済み重賞5競走のみ。発走予定時刻・出走頭数・発売券種は未登録。中央の一般競走、地方、海外、2027年度の個別レースは未収録。手動登録で利用できます。",
  "sources": [
    {
      "id": "jra-tokyo5-2026",
      "title": "JRA 2026年第5回東京競馬番組（2026年9月6日変更版）",
      "url": "https://www.jra.go.jp/keiba/program/2026/pdf/bangumi/tokyo5.pdf",
      "checkedOn": "2026-11-08",
      "coverage": "開催日・競馬場・レース番号・重賞名・距離・馬場・格のみ確認。発走時刻と出走頭数は未確認。"
    },
    {
      "id": "nar-calendar-2026",
      "title": "NAR 2026年日程表",
      "url": "https://www.keiba.go.jp/RaceScheduleList/RaceScheduleListTop.html",
      "checkedOn": "2026-11-08",
      "coverage": "日程の入口を確認。個別レース番号・時刻は取り込んでいません。"
    },
    {
      "id": "bha-fixtures",
      "title": "BHA 開催日程",
      "url": "https://www.britishhorseracing.com/racing/fixtures/full-year/",
      "checkedOn": "2026-11-08",
      "coverage": "開催日程の入口を確認。個別レースは取り込んでいません。"
    }
  ],
  "races": [
    {
      "id": "jra-20261107-tokyo-11",
      "date": "2026-11-07",
      "category": "central",
      "country": "日本",
      "venue": "東京",
      "number": 11,
      "name": "京王杯2歳ステークス",
      "surface": "turf",
      "distance": 1400,
      "grade": "GⅡ",
      "class": "graded",
      "startAt": null,
      "zone": "Asia/Tokyo",
      "sourceIDs": [
        "jra-tokyo5-2026"
      ],
      "checkedOn": "2026-11-08",
      "manual": false,
      "confirmedKinds": null
    },
    {
      "id": "jra-20261108-tokyo-11",
      "date": "2026-11-08",
      "category": "central",
      "country": "日本",
      "venue": "東京",
      "number": 11,
      "name": "アルゼンチン共和国杯",
      "surface": "turf",
      "distance": 2500,
      "grade": "GⅡ",
      "class": "graded",
      "startAt": null,
      "zone": "Asia/Tokyo",
      "sourceIDs": [
        "jra-tokyo5-2026"
      ],
      "checkedOn": "2026-11-08",
      "manual": false,
      "confirmedKinds": null
    },
    {
      "id": "jra-20261114-tokyo-11",
      "date": "2026-11-14",
      "category": "central",
      "country": "日本",
      "venue": "東京",
      "number": 11,
      "name": "武蔵野ステークス",
      "surface": "dirt",
      "distance": 1600,
      "grade": "GⅢ",
      "class": "graded",
      "startAt": null,
      "zone": "Asia/Tokyo",
      "sourceIDs": [
        "jra-tokyo5-2026"
      ],
      "checkedOn": "2026-11-08",
      "manual": false,
      "confirmedKinds": null
    },
    {
      "id": "jra-20261123-tokyo-11",
      "date": "2026-11-23",
      "category": "central",
      "country": "日本",
      "venue": "東京",
      "number": 11,
      "name": "東京スポーツ杯2歳ステークス",
      "surface": "turf",
      "distance": 1800,
      "grade": "GⅡ",
      "class": "graded",
      "startAt": null,
      "zone": "Asia/Tokyo",
      "sourceIDs": [
        "jra-tokyo5-2026"
      ],
      "checkedOn": "2026-11-08",
      "manual": false,
      "confirmedKinds": null
    },
    {
      "id": "jra-20261129-tokyo-12",
      "date": "2026-11-29",
      "category": "central",
      "country": "日本",
      "venue": "東京",
      "number": 12,
      "name": "ジャパンカップ",
      "surface": "turf",
      "distance": 2400,
      "grade": "GⅠ",
      "class": "graded",
      "startAt": null,
      "zone": "Asia/Tokyo",
      "sourceIDs": [
        "jra-tokyo5-2026"
      ],
      "checkedOn": "2026-11-08",
      "manual": false,
      "confirmedKinds": null
    }
  ]
};
