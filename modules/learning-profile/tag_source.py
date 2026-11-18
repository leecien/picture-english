# -*- coding: utf-8 -*-
"""LEARNING-PROFILE-01 hand-authored source (external AI, 2026-11-18).

GRAMMAR_REVIEWED: the grammar a sentence CONTAINS (exposure), reviewed by hand. It never means the item TESTS that grammar:
what an attempt is evidence for is decided by the question type (QTYPES in build_profile_data.py).
Codes: ps present simple · pc present continuous · pcf present continuous for a future arrangement · pst past simple ·
pstc past continuous · pp present perfect · ppc present perfect continuous · pastp past perfect · gt be going to ·
wl will · wd would (conditional / reported) · mod modal (can/could/may/should/must) · wdl would like · lets let's ·
imp imperative · there there is/are · pass passive · cond conditional · frag no finite verb (short reply)
Forms (negative / yes-no question / wh-question) are detected automatically; they are reliable from punctuation and auxiliaries.
"""

TOPICS = {
    "food": {"zh": "食物", "sub": {
        "ingredients": {"zh": "食材", "desc": "食物、食材與飲料名稱；採買食材"},
        "ordering": {"zh": "點餐", "desc": "訂位、點餐、用餐中的請求、結帳、外帶"},
        "cooking": {"zh": "烹飪", "desc": "廚房器具、加熱與烹調動作、保存食物"},
        "dietary": {"zh": "飲食需求", "desc": "過敏、素食、忌口、辣度甜度與份量調整"},
    }},
    "travel": {"zh": "旅遊", "sub": {
        "airport": {"zh": "機場", "desc": "報到、托運、安檢、登機、機上、領行李"},
        "customs": {"zh": "海關", "desc": "入境目的、停留天數、住宿地點、申報"},
        "lodging": {"zh": "住宿", "desc": "飯店入住退房、訂房、客房問題"},
        "directions": {"zh": "問路", "desc": "問地點、方向、距離與步行"},
        "transport": {"zh": "交通", "desc": "計程車、火車地鐵、公車、租車、自行車與機車"},
    }},
    "work": {"zh": "職場", "sub": {
        "negotiation": {"zh": "商務談判", "desc": "議價、預算、交期、確認成交與後續（本版只建立這個次主題）"},
    }},
    "meeting": {"zh": "會議", "sub": {
        "scheduling": {"zh": "安排時間", "desc": "約時間、改期、確認是否有空"},
        "opening": {"zh": "開場", "desc": "開始會議、確認聽得到、分享畫面、介紹主題與進行議程"},
        "opinions": {"zh": "表達意見", "desc": "同意、不同意、提出看法與提案"},
        "confirming": {"zh": "確認事項", "desc": "請對方重複、確認細節、提問與確認共識"},
        "actions": {"zh": "會後行動", "desc": "收尾、寄送資料、回覆期限、後續確認"},
    }},
}

# Default topic for whole scenes. "general" = belongs to the topic but to none of the subtopics.
SCENE_TOPIC = {
    "dining/reserve": ("food", "ordering"), "dining/order": ("food", "ordering"), "dining/diet": ("food", "dietary"),
    "dining/problems": ("food", "ordering"), "dining/bill": ("food", "ordering"), "dining/cafe": ("food", "ordering"),
    "dining/fastfood": ("food", "ordering"), "dining/bar": ("food", "ordering"), "companion/food": ("food", "general"),
    "life/restaurant": ("food", "ordering"), "life/supermarket": ("food", "ingredients"), "life/kitchen": ("food", "cooking"),
    "travel/airport": ("travel", "airport"), "travel/security": ("travel", "airport"), "travel/inflight": ("travel", "airport"),
    "travel/baggage": ("travel", "airport"), "travel/lostbag": ("travel", "airport"), "travel/customs": ("travel", "customs"),
    "travel/hotel": ("travel", "lodging"), "travel/roomservice": ("travel", "lodging"), "travel/directions": ("travel", "directions"),
    "travel/taxi": ("travel", "transport"), "travel/train": ("travel", "transport"), "travel/rentcar": ("travel", "transport"),
    "travel/money": ("travel", "general"), "travel/sights": ("travel", "general"), "companion/trip": ("travel", "general"),
    "life/airport": ("travel", "airport"), "life/street": ("travel", "transport"),
    "work/meeting": ("meeting", "general"), "work/schedule": ("meeting", "general"), "work/presentation": ("meeting", "general"),
    "work/negotiate": ("work", "negotiation"),
}

# Item-level subtopic (overrides the scene default). Key: scene/en
ITEM_TOPIC = {
    # food
    "dining/order/Is this dish spicy?": ("food", "dietary"),
    "dining/order/No ice, please.": ("food", "dietary"),
    "dining/cafe/Can I have it with less sugar?": ("food", "dietary"),
    "dining/cafe/Do you have oat milk?": ("food", "dietary"),
    "dining/fastfood/No pickles, please.": ("food", "dietary"),
    "dining/bar/Something without alcohol, please.": ("food", "dietary"),
    "companion/food/How about noodles?": ("food", "ingredients"),
    "companion/food/Yes, I love spicy food.": ("food", "dietary"),
    "companion/food/My favorite food is fried rice.": ("food", "ingredients"),
    "companion/food/Yes, a cup of tea, please.": ("food", "ordering"),
    "companion/food/Let's eat here.": ("food", "ordering"),
    "life/restaurant/I'll put my phone in my bag.": ("food", "general"),
    "life/supermarket/Put the fruit in the basket.": ("food", "ingredients"),
    # travel
    "life/airport/I'll call my family on my phone.": ("travel", "general"),
    "life/street/Which bus goes to the station?": ("travel", "transport"),
    "life/street/Use the crosswalk to cross the street.": ("travel", "directions"),
    "companion/trip/We can take the train.": ("travel", "transport"),
    "companion/trip/Let's book a small hotel.": ("travel", "lodging"),
    # meeting
    "work/meeting/Can everyone hear me?": ("meeting", "opening"),
    "work/meeting/Let's get started.": ("meeting", "opening"),
    "work/meeting/Let me share my screen.": ("meeting", "opening"),
    "work/meeting/Could you say that again?": ("meeting", "confirming"),
    "work/meeting/I agree with you.": ("meeting", "opinions"),
    "work/meeting/I have a different idea.": ("meeting", "opinions"),
    "work/meeting/Can we move on to the next topic?": ("meeting", "opening"),
    "work/meeting/Let's schedule another meeting.": ("meeting", "scheduling"),
    "work/meeting/Let's wrap up for today.": ("meeting", "actions"),
    "work/schedule/Are you free next Monday?": ("meeting", "scheduling"),
    "work/schedule/Does three o'clock work for you?": ("meeting", "scheduling"),
    "work/schedule/Let's meet on Thursday afternoon.": ("meeting", "scheduling"),
    "work/schedule/I need to reschedule our meeting.": ("meeting", "scheduling"),
    "work/schedule/Could you send me the details?": ("meeting", "confirming"),
    "work/schedule/Please find the file attached.": ("meeting", "actions"),
    "work/schedule/Sorry for the late reply.": ("meeting", "general"),
    "work/schedule/I'll get back to you by Friday.": ("meeting", "actions"),
    "work/presentation/Today I'd like to talk about our new product.": ("meeting", "opening"),
    "work/presentation/Let's look at this chart.": ("meeting", "opening"),
    "work/presentation/Sales went up last quarter.": ("meeting", "general"),
    "work/presentation/This is the most important point.": ("meeting", "opinions"),
    "work/presentation/To sum up, we need more time.": ("meeting", "opinions"),
    "work/presentation/Does anyone have any questions?": ("meeting", "confirming"),
    "work/presentation/That's a good question.": ("meeting", "general"),
    "work/presentation/Thank you for your attention.": ("meeting", "actions"),
    "work/phone/I'm calling about the meeting tomorrow.": ("meeting", "scheduling"),
    "life/office/Write the meeting time in your notebook.": ("meeting", "scheduling"),
}

# Secondary topic tags (revision 9): negotiation lines are filed under work/negotiation; a meeting tag only where the
# line itself does a meeting job. One event still counts at most once per topic, and totals count every event once
# (see RULES.md §5). Reviewed 2026-11-17 (batch-04):
#   kept    "I think we have a deal."        → meeting/confirming: states the agreement reached (確認共識)
#   kept    "Let's put it in writing."       → meeting/actions: a follow-up action after the talk (會後書面確認)
#   dropped "Can you deliver by the end of the month?" — a delivery term being bargained, not a meeting check
#   dropped "I need to check with my manager." — a negotiation stall, not a meeting action item
SECONDARY_TOPIC = {
    "work/negotiate/I think we have a deal.": [("meeting", "confirming")],
    "work/negotiate/Let's put it in writing.": [("meeting", "actions")],
}

# Hand-reviewed grammar the sentence contains (main clause first).
GRAMMAR_REVIEWED = {
    # ---------- food ----------
    "I'd like to make a reservation.": "wdl", "For four people, please.": "frag", "At seven tonight.": "frag",
    "Do you have a table by the window?": "ps", "Can we sit outside?": "mod", "We have a reservation under Lin.": "ps",
    "How long is the wait?": "ps", "I'd like to cancel my reservation.": "wdl",
    "A table for two, please.": "frag", "Can I see the menu, please?": "mod", "What's today's special?": "ps",
    "What do you recommend?": "ps", "Is this dish spicy?": "ps", "Yes, I'd like the chicken salad.": "wdl",
    "I'll have the same.": "wl", "Medium, please.": "frag", "Can I have some water, please?": "mod", "No ice, please.": "frag",
    "I'm a vegetarian.": "ps", "Does this have meat in it?": "ps", "I'm allergic to peanuts.": "ps", "I can't eat seafood.": "mod",
    "Could you make it less spicy?": "mod", "Can I have it without onions?": "mod", "Is this gluten free?": "ps",
    "Could I have the dressing on the side?": "mod",
    "Could we have more time to decide?": "mod", "Excuse me, we're still waiting for our food.": "pc",
    "This is not what I ordered.": "ps pst", "My soup is cold.": "ps", "Could you warm this up?": "mod", "Could I have a clean fork?": "mod",
    "Could we have some more napkins?": "mod", "Can I have a box for the leftovers?": "mod",
    "Can I have the bill, please?": "mod", "Is the service charge included?": "ps pass", "Can we pay separately?": "mod",
    "Card, please.": "frag", "I think there's a mistake on the bill.": "ps there", "Could I get a receipt?": "mod",
    "Can I get this to go?": "mod", "Keep the change.": "imp",
    "A large latte, please.": "frag", "Could I get an iced americano?": "mod", "Can I have it with less sugar?": "mod",
    "Do you have oat milk?": "ps", "To go, please.": "frag", "My name is Amy.": "ps", "No, that's all. Thank you.": "ps",
    "Can I have a receipt?": "mod",
    "I'd like a cheeseburger, please.": "wdl", "Yes, with fries and a coke.": "frag", "Medium size, please.": "frag",
    "No pickles, please.": "frag", "For here, please.": "frag", "Could I have some ketchup?": "mod", "Can I get a refill?": "mod",
    "Could I see the drink menu?": "mod", "What beers do you have on tap?": "ps", "I'll have a glass of red wine.": "wl",
    "Something without alcohol, please.": "frag", "Can I start a tab?": "mod", "Another one, please.": "frag", "Cheers!": "frag",
    "How about noodles?": "frag", "Yes, I love spicy food.": "ps", "My favorite food is fried rice.": "ps",
    "Yes, a cup of tea, please.": "frag", "Let's eat here.": "lets", "It was delicious!": "pst", "Sure. Hold them like this.": "imp",
    "Could I have a glass of water?": "mod", "Please put the salad on my plate.": "imp", "I need a spoon for my soup.": "ps",
    "I'd like a bowl of soup.": "wdl", "May I see the menu, please?": "mod", "I'll put my phone in my bag.": "wl",
    "I'll buy an apple for breakfast.": "wl", "I'd like a banana for my snack.": "wdl", "We need a tomato for the salad.": "ps",
    "Let's buy some bread for sandwiches.": "lets", "We need some milk for breakfast.": "ps", "Put the fruit in the basket.": "imp",
    "Put the milk in the refrigerator.": "imp", "Turn off the stove after cooking.": "imp", "Heat the rice in the microwave.": "imp",
    "Fill the kettle with water.": "imp", "Cook the egg in the pan.": "imp", "Put the vegetables in the pot.": "imp",
    # ---------- travel ----------
    "I'm flying to Tokyo.": "pcf", "Here is my passport.": "ps", "Yes, I have one suitcase.": "ps", "Is it overweight?": "ps",
    "Can I have a window seat?": "mod", "Can I have an aisle seat, please?": "mod", "Could we sit together?": "mod",
    "What time does boarding start?": "ps", "Which gate should I go to?": "mod", "Will I miss my connecting flight?": "wl",
    "Should I take off my shoes too?": "mod", "Just a small bottle of lotion.": "frag", "Can I bring this on the plane?": "mod",
    "Okay, no problem.": "frag", "Is this the line for boarding?": "ps", "Here you are.": "ps",
    "Excuse me, I think you are in my seat.": "ps", "Could you help me put my bag up there?": "mod",
    "Chicken, please.": "frag", "Orange juice, please.": "frag", "Could I have a blanket?": "mod",
    "Could I have another glass of water?": "mod", "May I recline my seat?": "mod", "Excuse me, could I get out?": "mod",
    "How long is the flight?": "ps", "I feel a little sick.": "ps", "Yes, could I have one, please?": "mod",
    "I'm here for sightseeing.": "ps", "I'm here on business.": "ps", "I will stay for five days.": "wl",
    "I'm staying at a hotel downtown.": "pc", "Yes, this is my first time here.": "ps", "I'm an office worker.": "ps",
    "No, I'm traveling with my family.": "pc", "Sure, here is my return ticket.": "ps", "About five hundred dollars.": "frag",
    "No, I have nothing to declare.": "ps",
    "Where is the baggage claim?": "ps", "Which belt is for my flight?": "ps", "Where can I get a cart?": "mod",
    "My suitcase hasn't arrived.": "pp", "I think my bag is lost.": "ps", "It's a large black suitcase.": "ps",
    "My suitcase is damaged.": "ps", "Please send it to my hotel.": "imp",
    "My bag is not here.": "ps", "It's a big black suitcase.": "ps", "Here it is.": "ps",
    "I'm staying at a hotel near the beach.": "pc", "Thank you very much.": "frag",
    "Where can I exchange money?": "mod", "What is the exchange rate today?": "ps", "I'd like to change three hundred dollars.": "wdl",
    "Is there a service fee?": "ps there", "Could I have some small bills?": "mod", "Is there an ATM near here?": "ps there",
    "The machine kept my card.": "pst",
    "I'd like to check in, please.": "wdl", "Yes, under the name Chen.": "frag", "Three nights, please.": "frag",
    "Is breakfast included?": "ps pass", "What time is breakfast?": "ps", "Can I have a room with a view?": "mod",
    "Could I check in early?": "mod", "Can I leave my luggage here?": "mod", "What time is check out?": "ps",
    "I'd like to check out, please.": "wdl",
    "The air conditioner isn't working.": "pc", "There's no hot water.": "ps there", "Can I get some extra towels?": "mod",
    "The room is too noisy.": "ps", "Could I change rooms?": "mod", "Could you clean my room, please?": "mod",
    "I locked myself out.": "pst", "Could I have a wake up call at seven?": "mod", "How do I connect to the internet?": "ps",
    "Excuse me, where is the train station?": "ps", "How do I get to the museum?": "ps", "Is it far from here?": "ps",
    "Can I walk there?": "mod", "Thank you for your help.": "frag", "Could you show me on the map?": "mod",
    "Where is the nearest subway station?": "ps", "Is there a convenience store near here?": "ps there",
    "Which way is the beach?": "ps", "I think I'm lost.": "ps",
    "Please take me to this address.": "imp", "How much is it to the airport?": "ps", "Could you turn on the meter?": "mod",
    "I'm in a hurry.": "ps", "Could you wait for me here?": "mod", "Please stop here.": "imp", "Could you open the trunk?": "mod",
    "Can I pay by credit card?": "mod",
    "One ticket to the airport, please.": "frag", "A round trip ticket, please.": "frag", "How do I buy a transit card?": "ps",
    "Which platform is it?": "ps", "Does this train go downtown?": "ps", "How many stops is it?": "ps",
    "Where should I change trains?": "mod", "Is this seat taken?": "ps pass", "When is the next train?": "ps",
    "I'd like to rent a car for three days.": "wdl", "Do you have an automatic car?": "ps",
    "Here is my international driving permit.": "ps", "Is insurance included?": "ps pass", "The car has a scratch here.": "ps",
    "Do I need to return it with a full tank?": "ps", "Is there a gas station near here?": "ps there",
    "Where can I return the car?": "mod",
    "Two adult tickets, please.": "frag", "Is there a student discount?": "ps there", "What time does it close?": "ps",
    "Is there a guided tour?": "ps there", "Do you have a map in Chinese?": "ps", "Where is the entrance?": "ps",
    "Can I take pictures here?": "mod", "Could you take a picture of us?": "mod", "What do you recommend seeing here?": "ps",
    "Let's go to the beach.": "lets", "We can take the train.": "mod", "Let's leave tomorrow morning.": "lets",
    "Two or three days.": "frag", "We need a map and some snacks.": "ps", "Let's book a small hotel.": "lets",
    "I want to take lots of photos.": "ps",
    "I'd like to check in this suitcase.": "wdl", "My backpack fits under the seat.": "ps", "Please check the date on your ticket.": "imp",
    "I'll call my family on my phone.": "wl",
    "Our car is parked outside.": "ps pass", "Which bus goes to the station?": "ps", "I ride my bicycle to work.": "ps",
    "Use the crosswalk to cross the street.": "imp", "Put on your helmet before you ride.": "imp", "Where can I park my scooter?": "mod",
    # ---------- meeting / work ----------
    "Can everyone hear me?": "mod", "Let's get started.": "lets", "Let me share my screen.": "imp",
    "Could you say that again?": "mod", "I agree with you.": "ps", "I have a different idea.": "ps",
    "Can we move on to the next topic?": "mod", "Let's schedule another meeting.": "lets", "Let's wrap up for today.": "lets",
    "Are you free next Monday?": "ps", "Does three o'clock work for you?": "ps", "Let's meet on Thursday afternoon.": "lets",
    "I need to reschedule our meeting.": "ps", "Could you send me the details?": "mod", "Please find the file attached.": "imp",
    "Sorry for the late reply.": "frag", "I'll get back to you by Friday.": "wl",
    "Today I'd like to talk about our new product.": "wdl", "Let's look at this chart.": "lets", "Sales went up last quarter.": "pst",
    "This is the most important point.": "ps", "To sum up, we need more time.": "ps", "Does anyone have any questions?": "ps",
    "That's a good question.": "ps", "Thank you for your attention.": "frag",
    "Could you lower the price a little?": "mod", "That's a little over our budget.": "ps", "What if we order a larger quantity?": "ps",
    "Can you deliver by the end of the month?": "mod", "I need to check with my manager.": "ps", "I think we have a deal.": "ps",
    "Let's put it in writing.": "lets",
    "I'm calling about the meeting tomorrow.": "pc", "Write the meeting time in your notebook.": "imp",
    # ---------- tense examples elsewhere (exposure for the grammar map) ----------
    "The package was damaged.": "pst pass", "I received the wrong item.": "pst", "My order hasn't arrived yet.": "pp",
    "I lost my bank card.": "pst", "Hi, I just moved in next door.": "pst", "I received a package for you.": "pst",
    "How was your weekend?": "pst", "It was nice talking to you.": "pst", "I had a great time tonight.": "pst",
    "It was my fault.": "pst", "I just joined the team.": "pst", "It was great. I went to the beach.": "pst",
    "Did you find us easily?": "pst", "I lost my wallet.": "pst", "I left my phone in the taxi.": "pst", "I lost my passport.": "pst",
    "Someone stole my bag.": "pst", "A man took my phone and ran away.": "pst", "My friend fainted.": "pst",
    "My car broke down.": "pst", "Yes, I slept very well.": "pst", "Has anyone turned in a black bag?": "pp",
    "I've been here for two weeks.": "pp", "I've worked here for three years.": "pp", "There's been an accident.": "pp there",
    "It looks like it's going to rain.": "ps gt", "I'm looking for lip balm.": "pc", "I'm looking for a phone charger.": "pc",
    "My sink is leaking.": "pc", "I'm not feeling well today.": "pc", "I'm calling about the apartment for rent.": "pc",
    "I'll take it.": "wl", "Will this plug work in Taiwan?": "wl", "I'll take three if it's cheaper.": "wl cond",
    "I'll think about it.": "wl", "How long will it take?": "wl", "I'll be home after six.": "wl", "How much will it cost?": "wl",
    "I'll call you back later.": "wl", "I'll be a little late this morning.": "wl", "I'll walk you to the elevator.": "wl",
    "Yes, I'll take it.": "wl", "The nurse will help you.": "wl",
    "It is raining, so I take an umbrella.": "pc ps", "We are going to fly to Japan tomorrow.": "gt",
    "She had a fever, so she went to the hospital.": "pst", "If it rains, we will stay at home.": "cond ps wl",
    "He ran because he was late.": "pst", "I have studied English for two years.": "pp", "The bus was late because of the rain.": "pst",
    "I have lived here since 2020.": "pp", "The museum was built in 1900.": "pst pass", "She is the girl who won the race.": "ps pst",
    "If I were rich, I would buy a boat.": "cond wd", "I am looking forward to the trip.": "pc",
    "The train had already left when we arrived.": "pastp pst", "The report must be finished by Friday.": "mod pass",
    "He said that he would call me later.": "pst wd", "Had I known, I would have helped you.": "cond wd",
    "Despite the rain, the concert continued.": "pst", "The meeting has been postponed until next week.": "pp pass",
    "She has been working here for ten years.": "ppc", "The car needs to be repaired.": "ps pass",
}

CODE = {
    "ps": "tense:present-simple", "pc": "tense:present-continuous", "pcf": "tense:present-continuous-future",
    "pst": "tense:past-simple", "pstc": "tense:past-continuous", "pp": "tense:present-perfect",
    "ppc": "tense:present-perfect-continuous", "pastp": "tense:past-perfect", "gt": "tense:going-to", "wl": "tense:will",
    "wd": "support:would", "mod": "support:modal", "wdl": "support:would-like", "lets": "support:lets", "imp": "support:imperative",
    "there": "support:there-be", "pass": "support:passive", "cond": "support:conditional", "frag": "support:fragment",
}
