/* PitCRM assistant: what to do with each contact, what to answer when a driver
   writes back, and the call script. Texts come from the business plan
   (sections 5–6). Rule-based: keywords in English and Russian, no paid AI. */
(function () {
  "use strict";

  var BOOK = "https://goliunov.github.io/book/";

  // order matters: the first rule that matches wins
  var REPLIES = [
    { key: "no", label: "Отказ", stage: "Lost",
      re: /not interested|no thanks|no thank you|not for me|stop (messag|writ)|unsubscribe|don'?t (message|write|contact)|leave me|не интерес|не надо|не пиши/i,
      why: "Вежливо закройте и больше не пишите. Хороший тон — шанс на рекомендацию позже.",
      text: "No worries at all — thanks for letting me know. Good luck with the season, {first}!" },
    { key: "price", label: "Спрашивает цену", stage: "",
      re: /how much|price|pricing|cost|rate|fee|charge|\$|€|сколько|цен[аы]|стоим/i,
      why: "На прямой вопрос отвечайте честно и сразу ведите на бесплатный аудит. Без оправданий и скидок.",
      text: "Fair question — the programme is $1,500 a month, three-month minimum, with a re-test every month so you see it working. Before any of that I'd want to see where you're at: free audit, 3 short videos + a short call, no strings. Want a slot this week? " + BOOK },
    { key: "expensive", label: "«Дорого»", stage: "",
      re: /expensive|too much|can'?t afford|out of (my )?budget|budget|pricey|дорог|не потян/i,
      why: "«Дорого» обычно значит «не уверен, что сработает». Сравните с бюджетом сезона и снимите риск гарантией.",
      text: "Fair. Compared to what? You're spending [season budget] on track time — this is what makes sure your body doesn't waste it. And if the first re-test shows nothing, month two is on me." },
    { key: "parents", label: "Решает не он (родители / спонсор)", stage: "",
      re: /parent|my dad|my father|my mum|my mom|sponsor|ask my|team decides|management|родител|папа|мама|спонсор/i,
      why: "Предложите поговорить с тем, кто платит, или пришлите короткое резюме на одну страницу.",
      text: "Makes sense. Want me to join a quick call with them? Or I can send a one-page summary of what we talked about." },
    { key: "trainer", label: "«Уже есть тренер»", stage: "",
      re: /trainer|coach|physio|work with (someone|a guy)|already (have|train|work)|тренер|физио/i,
      why: "Не конкурируйте с его тренером. Вы закрываете то, что относится к машине: шея, дыхание, выносливость в кокпите, перелёты.",
      text: "Good, keep them. I don't replace gym work — I cover what's specific to the car: neck, breathing, endurance in the seat, travel weeks. Many of my drivers do both." },
    { key: "notnow", label: "«Не сейчас / после сезона»", stage: "Nurture",
      re: /after the season|not now|not right now|later|next year|next season|maybe in|busy|off.?season|in (a few|couple of) (weeks|months)|сейчас не|позже|после сезона|не время/i,
      why: "Нет срочности. Межсезонье — лучшее время строить базу. Назовите месяц старта и реальное число свободных мест. Не согласится — этап «Позже», CRM вернёт его через 75 дней.",
      text: "Totally. Just so you know — off-season is exactly when the base gets built. If we start in [month], you're at 100% for round 1. I have [N] spots left for that window." },
    { key: "think", label: "«Подумаю»", stage: "",
      re: /think about|let me think|think it over|consider|i'?ll see|get back to you|подума|посмотрю/i,
      why: "За «подумаю» почти всегда одно невысказанное сомнение. Спросите прямо, какое.",
      text: "Sure. Usually when someone says that, there's one thing that's not sitting right. What is it for you?" },
    { key: "info", label: "«Пришли информацию»", stage: "",
      re: /send (me )?(some )?(more )?info|more info|more details|details|website|brochure|пришли|инфо|подробн/i,
      why: "Не высылайте презентацию. Узнайте, что он хочет исправить, и снова предложите аудит.",
      text: "Sure. So I send the right thing — what's the main thing you'd want to fix?" },
    { key: "yes_routine", label: "Да, пришли упражнение", stage: "", when: function (c) { return c.template === "B" || c.template === "N" || c.template === "F1"; },
      re: /\byes\b|\byeah\b|\byep\b|\bsure\b|please|send it|go ahead|why not|\bok\b|okay|would love|да\b|давай|присылай|конечно/i,
      why: "Он принял подарок. Пришлите упражнение и мягко предложите аудит — тот же разговор, без давления.",
      text: "Here you go: [routine link]. Do it the night before and the morning of the race. If you want, send me 3 short videos and I'll tell you exactly what's limiting you in the car — free, takes a short call: " + BOOK },
    { key: "yes", label: "Интересно / да", stage: "",
      re: /\byes\b|\byeah\b|\bsure\b|interested|sounds good|let'?s do|let'?s go|\bok\b|okay|why not|tell me more|how does it work|keen|да\b|интересно|давай|как это работает/i,
      why: "Тёплый ответ. Не продавайте в переписке — сразу ведите на бесплатный аудит.",
      text: "Awesome. Here's how it works: you send me 3 short videos (I'll tell you which), then we jump on a short video call and I tell you exactly what's limiting you and how I'd fix it. Free, no strings. Pick a time that works: " + BOOK },
    { key: "problem", label: "Назвал проблему", stage: "",
      re: /neck|back|shoulder|tired|fatigue|stint|endurance|pain|sore|heat|cramp|breath|focus|g.?force|шея|спина|устал|болит|выносл|жара/i,
      why: "Он сам назвал боль — лучший момент. Повторите его слова и предложите аудит. Впишите боль в карточку: она пригодится на созвоне.",
      text: "Makes sense — that's super common with [his problem in his words]. Here's what I do: you send me 3 short videos (I'll tell you which), then we jump on a short video call and I tell you exactly what's limiting you and how I'd fix it. Free, no strings. Want a slot this week? " + BOOK },
    { key: "other", label: "Не распознал", stage: "", re: /[\s\S]/,
      why: "Ответьте по-человечески на то, что он написал, и закончите вопросом про его тело в машине. Цель разговора — бесплатный аудит.",
      text: "Thanks for getting back to me, {first}! [answer what he wrote]. Quick one: where does your body give up first in a long stint — neck, back, or focus?" }
  ];

  function classify(text, c) {
    var t = String(text || "");
    for (var i = 0; i < REPLIES.length; i++) {
      var r = REPLIES[i];
      if (r.when && !r.when(c)) continue;
      if (r.re.test(t)) return r;
    }
    return REPLIES[REPLIES.length - 1];
  }

  // one line: what to do with this card right now
  function todo(c, kind, tpl) {
    var fu = (Number(c.fu) || 0) + 1;
    if (kind === "reply") return "Он ответил. Вставьте его сообщение ниже → «Подсказать ответ». Цель — записать на бесплатный аудит.";
    if (tpl === "T") return "Попросите видеоотзыв и рекомендацию. Впишите вместо [result] конкретный результат вашей работы с ним.";
    if (kind === "fu") {
      if (fu === 1) return "Не ответил 3 дня. Пришлите полезное: ссылку на 30-секундное упражнение вместо [video].";
      if (fu === 2) return "Не ответил неделю. Впишите реальный результат клиента — не выдумывайте. Если кейса ещё нет, выберите F3 или напишите по-своему.";
      return "Последнее сообщение. Если не ответит — CRM поставит паузу на 75 дней.";
    }
    if (c.stage === "Nurture") return "Вы писали ему весной, ответа не было. Новый повод — новый сезон. Можно отправлять как есть.";
    if (tpl === "C") return "Instagram не найден. Отправьте запрос в контакты LinkedIn с этим текстом.";
    if (tpl === "D") return "Это письмо. Впишите сезон или ближайший этап вместо [season/next round].";
    if (!c.instagram && !c.whatsapp && !c.linkedin && !c.email) return "Контактов нет. «Найти Instagram» → впишите профиль в карточку (нажмите на имя) → вернитесь сюда.";
    return "Откройте профиль, найдите его последнюю гонку и впишите деталь вместо [скобок]. Персональное сообщение получает ответ, шаблон — нет.";
  }

  var CALL = [
    { t: "Рамка", min: 2, ru: "Объясните, как пройдёт созвон. Снимает напряжение и даёт вам контроль.",
      en: "Here's how this works: I'll ask about your season and how your body feels in the car, then tell you what I saw in your videos. If it makes sense to work together, I'll tell you how. If not, you still leave with what to fix. Sound good?" },
    { t: "Ситуация", min: 8, ru: "Серия, календарь, как тренируется сейчас.",
      en: "Which series and calendar next year? How do you train now? Who's coaching you?" },
    { t: "Проблема", min: 10, ru: "Где и когда тело сдаётся. Просите конкретный пример. Говорит он — 70% времени.",
      en: "Where does your body give up first? When exactly — which lap, which session? Give me a recent example." },
    { t: "Цена проблемы", min: 5, ru: "Самый важный шаг. Спросите и молчите, пусть он сам скажет, чего это стоит.",
      en: "What does that cost you — lap time, consistency, what the team thinks of you? What happens if next season is the same?" },
    { t: "Желаемое", min: 5, ru: "Пусть опишет, каким будет сезон, если это исправить.",
      en: "If we fixed this, what would next season look like?" },
    { t: "Разбор видео", min: 5, ru: "2–3 конкретных наблюдения из его видео, свяжите их с его проблемой. Здесь продаёт ваша экспертиза.", en: "" },
    { t: "Оффер", min: 5, ru: "Его словами: проблема → цель → как вы это сделаете. Назовите цену спокойно и замолчите.",
      en: "Okay, you told me [his problem in his words] and you want [his goal]. Here's how I'd do it: testing, a programme around your race calendar, 4 calls a month and a monthly re-test. It's $1,500 a month, three-month minimum, with a re-test every month so you see it working." },
    { t: "Закрытие", min: 2, ru: "Если «да» — сразу дата старта и ссылка на оплату. Если сомневается — кнопки возражений ниже.",
      en: "Does that sound like what you need? … Great, I'll send the payment link now and we start with testing on [date]." }
  ];

  window.PitAssist = { classify: classify, todo: todo, CALL: CALL, OBJECTIONS: REPLIES.filter(function (r) { return /expensive|think|parents|trainer|notnow|info/.test(r.key); }) };
})();
