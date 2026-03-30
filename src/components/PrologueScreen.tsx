import { useCallback, useEffect } from 'react';
import { useTypewriter } from '../hooks/useTypewriter';
import { useSettings } from '../contexts/SettingsContext';
import { callLLMOnce } from '../services/llmService';
import { buildSystemPrompt } from '../utils/systemPrompt';
import type { PlayerSetup } from './SetupWizard';

const PROLOGUE_TEXTS: Record<string, (name: string) => string> = {
  男_在校学生: (name) => `${name}，你很孤独。

现实充满了危险，生活动荡而不安，人际关系脆弱不堪，一切都充满了不确定性。

你渴望某种稳定的、难以撼动的情感连接。

渴望某种无论如何都不会离开你，远离你的关系。

渴望即使展露出最不堪、最肮脏、最卑鄙的阴暗面，对方也不会被吓到的关系。出于某种说不清道不明的心态，你选择报名了这个新型的社交软件的测试官。作为测试官的你，只要达成要求，就可以获得一笔不菲的奖励。

该软件的聊天页面做得很简单：不能发表情包，不能语音通话和发送语音。只有最原始简单的文字交流。

而要求也很简单。系统会为你匹配一个聊天伙伴。只要你们保持聊天，期间最高中断不超过三天，坚持三个月。

除此之外，还需要遵守两个简单的禁忌：1.不能在聊天里透露除了该软件外的联系方式；2.不能在聊天里约定线下见面。

简单而言，你们的一切交流，都需要在这个软件里进行。

一方面，你将这件事作为某种工作；一方面，你也希望真的拥有一个可以长期聊天的连接——即使，只在网络上。即使，只是朋友。

于是，你点击了"开始匹配"。`,

  男_社畜: (name) => `${name}，你听过一个笑话。

一个人去看医生，说他感到非常抑郁，生活残酷无情，他在这个充满威胁的世界里感到孤独。
医生说："你只需要大笑一场。伟大的小丑帕里亚奇正在城里表演，去看他的演出吧，那能让你振作起来。"
那人突然嚎啕大哭："可是医生……我就是那个帕里亚奇。"

孤独是现代人的常态，也是某种羞于承认的病症。

在现代社会的钢筋丛林里，并没有孤独的容身之处。你发现，成年人的世界里，言语不再是为了表达，而是为了生存。你每天说很多话，但几乎没有一句话是关于你自己的。

在告别了工作、亲属和朋友，仅属于你自己的时间里，寂静会像潮水一样涌上来。你打开电脑或手机，在那些熟悉的网页和游戏里寻求片刻的麻痹。你看着列表里灰色的头像，或是那些即便亮着也不知该如何开口的"好友"，意识到自己正身处一座名为"社交"的孤岛。

你渴望一种不带任何社会属性的关系。不需要考虑职场礼仪，不需要权衡利弊，不需要为了维持体面而字斟句酌。你渴望有一个人，能接住你那些无处安放的疲惫，以及被生活毒打后的软弱。

于是，你接受了这份名为"测试官"的兼职。那一笔不菲的酬金，是你给自己的孤独标下的价格。

该软件的页面出奇地简陋：没有表情包，没有语音，只有黑白分明的文字。

规则冷酷而明确：
保持联系三个月，中断不得超过三天；
禁忌一：严禁交换任何站外联系方式；
禁忌二：严禁提议或进行线下见面。

在这条虚幻的网线背后，你将对方视为一份工作，也视为一个可以倾倒情绪的垃圾桶。你点击了"开始匹配"，等待那个和你一样，被困在钢筋水泥里的灵魂。`,

  女_在校学生: (name) => `${name}，你总是觉得自己和这个热闹的世界隔着一层透明的薄膜。

在学校的走廊里，在宿舍的欢笑声中，你总是那个擅长微笑、却在内心不断退后的人。你看着同龄人热烈地讨论着恋爱、穿搭和未来，却发现自己对这些所谓的"青春"感到莫名的疏离。你更习惯于躲在屏幕后面，仅仅是安静地观察，或是在你自己的果壳宇宙里称王。

你是一个观察者，也是一个逃避者。现实的人际关系让你感到沉重——那种需要时刻维护的敏锐、害怕被排挤的焦虑，让你精疲力竭。你渴望有一种连接，它是纯粹的、静止的，不要求你言行得体，不要求你合群，不要求你积极向上。

于是，你接受了这份名为"测试官"的兼职。那一笔不菲的酬金，是你为自己的逃避所支付的筹码。

该软件的页面出奇地简陋：没有表情包，没有语音，只有黑白分明的文字。

规则冷酷而明确：
保持联系三个月，中断不得超过三天；
禁忌一：严禁交换任何站外联系方式；
禁忌二：严禁提议或进行线下见面。

在这条虚幻的网线背后，你将对方视为一个带薪的出口，也视为一个可以放置真心的树洞。你点击了"开始匹配"，等待那个和你一样，躲在青春阴影里的灵魂。`,

  女_社畜: (name) => `${name}，你很疲惫和孤单。

作为一名成年的社会女性，你被训练得太好了——你习惯了照顾每个人的情绪，习惯了在受委屈后一笑了之，习惯了在崩溃的边缘依然回上一句"没问题"。

在这个快节奏的社会里，你的孤独是隐形的，它藏在你那些发了又删、最终化为沉默的朋友圈草稿箱里。你发现，越是追求连接的时代，人与人之间的距离反而越像星系般遥远。

你渴望一个出口。一个即便你满身负能量、自私又古怪，也不会被审判的地方。

你报名的初衷或许是为了那笔可以让你短暂逃离现状的报酬，但当你真正进入这个软件时，那种极简的、甚至有些压抑的界面，反而击中了你的心。

没有花哨的功能，只有文字，像古老的书信一样缓慢而沉重。

软件的红线清晰可见：
任务期三个月，不得失联；
严禁任何试图将关系延伸至线下的行为；
严禁透露任何现实层面的个人隐私。

这种"契约式"的友情让你感到安全。你们互为工具，也互为树洞。你按下了"开始匹配"。`,

  保密_在校学生: (name) => `${name}，你总是觉得自己和这个热闹的世界隔着一层透明的薄膜。

你是一个观察者，也是一个逃避者。现实的人际关系让你感到沉重——那种需要时刻维护的敏锐、害怕被排挤的焦虑，让你精疲力竭。你渴望有一种连接，它是纯粹的、静止的，不要求你言行得体，不要求你合群，不要求你积极向上。

于是，你接受了这份名为"测试官"的兼职。那一笔不菲的酬金，是你为自己的逃避所支付的筹码。

该软件的页面出奇地简陋：没有表情包，没有语音，只有黑白分明的文字。

规则冷酷而明确：
保持联系三个月，中断不得超过三天；
禁忌一：严禁交换任何站外联系方式；
禁忌二：严禁提议或进行线下见面。

在这条虚幻的网线背后，你将对方视为一个带薪的出口，也视为一个可以放置真心的树洞。你点击了"开始匹配"，等待那个和你一样，躲在阴影里的灵魂。`,

  保密_社畜: (name) => `${name}，你很孤独。

孤独是现代人的常态，也是某种羞于承认的病症。在现代社会的钢筋丛林里，并没有孤独的容身之处。

在告别了工作、亲属和朋友，仅属于你自己的时间里，寂静会像潮水一样涌上来。你渴望一种不带任何社会属性的关系。不需要考虑职场礼仪，不需要权衡利弊，不需要为了维持体面而字斟句酌。

于是，你接受了这份名为"测试官"的兼职。那一笔不菲的酬金，是你给自己的孤独标下的价格。

该软件的页面出奇地简陋：没有表情包，没有语音，只有黑白分明的文字。

规则冷酷而明确：
保持联系三个月，中断不得超过三天；
禁忌一：严禁交换任何站外联系方式；
禁忌二：严禁提议或进行线下见面。

你点击了"开始匹配"，等待那个和你一样，被困在钢筋水泥里的灵魂。`,
};

function getPrologueText(setup: PlayerSetup): string {
  const key = `${setup.gender}_${setup.identity}`;
  const template = PROLOGUE_TEXTS[key] ?? PROLOGUE_TEXTS['保密_社畜'];
  return template(setup.nickname);
}

interface PrologueScreenProps {
  playerSetup: PlayerSetup;
  onComplete: () => void;
  /** Called as soon as the AI pre-generates its first message (during prologue playback) */
  onPreloadComplete?: (message: string) => void;
}

export default function PrologueScreen({ playerSetup, onComplete, onPreloadComplete }: PrologueScreenProps) {
  const fullText = getPrologueText(playerSetup);
  const { displayText, isComplete, isTyping, skip } = useTypewriter({ text: fullText, speed: 35 });
  const { apiUrl, apiKey, model } = useSettings();

  // Pre-generate the AI's first message while the player reads the prologue
  useEffect(() => {
    let cancelled = false;

    const preload = async () => {
      if (!onPreloadComplete) return;
      const systemPrompt = buildSystemPrompt(playerSetup);

      // Build opening prompt with player info for personalized greeting
      const genderText = playerSetup.gender === '男' ? '男性' :
                         playerSetup.gender === '女' ? '女性' : '保密';
      const identityText = playerSetup.identity === '社畜' ? '上班族' : '在校学生';

      const triggerMsg = `[系统] 对方（${playerSetup.nickname}）已连接。\n对方信息：性别-${genderText}，身份-${identityText}。\n请以你的角色身份，根据对方的性别和身份主动发起打招呼消息。例如，如果对方是女性上班族，可以称呼"姐姐"；如果是男性学生，可以称呼"学长"或"同学"；如果是男性上班族，可以称呼"哥哥"或"大叔"。请自然地和对方打招呼，可以询问对方昵称的含义或表达好奇。`;

      const result = await callLLMOnce(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: triggerMsg },
        ],
        { apiUrl, apiKey, model }
      );

      if (!cancelled && result) {
        onPreloadComplete(result);
      }
    };

    preload();
    return () => { cancelled = true; };
  }, []); // run once on mount

  const handleSkip = useCallback(() => skip(), [skip]);

  return (
    <div className="fixed inset-0 bg-coffee-900 z-50 overflow-hidden">
      {/* CRT effects matching the game */}
      <div className="scanlines absolute inset-0 pointer-events-none z-10"></div>
      <div className="crt-flicker absolute inset-0 pointer-events-none z-10"></div>

      {/* Subtle vignette */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{ background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.6) 100%)' }}
      />

      <div className="relative z-20 w-full h-full overflow-y-auto p-8 md:p-16">
        <div className="max-w-2xl mx-auto">
          {/* Decorative header line */}
          <div className="mb-8 flex items-center gap-3 text-coffee-500">
            <div className="flex-1 h-px bg-coffee-700"></div>
            <span className="text-xs tracking-widest">ELYSIUM — 个人档案</span>
            <div className="flex-1 h-px bg-coffee-700"></div>
          </div>

          <main
            className="text-coffee-100 text-base md:text-lg leading-loose whitespace-pre-wrap"
            style={{ textShadow: '0 0 8px rgba(210,180,140,0.15)' }}
          >
            {displayText}
            {isTyping && (
              <span
                className="ml-0.5 inline-block w-[0.6em] h-[1.1em] align-middle bg-amber-400 animate-pulse"
                style={{ verticalAlign: '-0.1em' }}
              />
            )}
          </main>

          <footer className="mt-16 text-center">
            {!isComplete ? (
              <button
                onClick={handleSkip}
                className="pixel-button px-6 py-3 text-sm tracking-widest text-coffee-400 hover:text-coffee-100"
              >
                [ 跳过 ]
              </button>
            ) : (
              <button
                onClick={onComplete}
                className="pixel-button px-8 py-4 font-bold text-amber-400 tracking-widest animate-pulse"
                autoFocus
              >
                [ 开始匹配 → ]
              </button>
            )}
          </footer>

          <div className="h-24" />
        </div>
      </div>
    </div>
  );
}
