(() => {
  const script = document.currentScript;
  if (!script || document.getElementById("trade-agent-version-switcher")) return;

  const scriptUrl = new URL(script.src, window.location.href);
  const versionMarker = "/versions/";
  const markerIndex = scriptUrl.pathname.indexOf(versionMarker);
  const rootPath =
    markerIndex >= 0
      ? scriptUrl.pathname.slice(0, markerIndex)
      : scriptUrl.pathname.replace(/\/version-switcher\.js$/, "");
  const currentPath = window.location.pathname;
  const isClassic = currentPath.includes("/versions/classic/");
  const isAudienceIsolation = currentPath.includes(
    "/versions/audience-isolation/",
  );
  const isSceneAgentSkill = currentPath.includes(
    "/versions/scene-agent-skill/",
  );
  const isIntegratedExpertSkills = currentPath.includes(
    "/versions/integrated-expert-skills/",
  );
  const isExpertRecommendations = currentPath.includes(
    "/versions/expert-recommendations/",
  );
  const isQuestionSuggestions = currentPath.includes(
    "/versions/question-suggestions/",
  );
  const isCommonExpertsSkills = currentPath.includes(
    "/versions/common-experts-skills/",
  );
  const isCommonToolsSwitcher = currentPath.includes(
    "/versions/common-tools-switcher/",
  );
  const isSkillDirectExpertRouting = currentPath.includes(
    "/versions/skill-direct-expert-routing/",
  );
  const isSimplifiedSkillRouting = currentPath.includes(
    "/versions/simplified-skill-routing/",
  );

  const versions = [
    {
      id: "v2.10",
      name: "v2.10",
      detail: "场景选择与技能推荐",
      href: `${rootPath || ""}/`,
      latest: true,
    },
    {
      id: "v2.9",
      name: "v2.9",
      detail: "技能轻选与入口精简",
      href: `${rootPath || ""}/versions/simplified-skill-routing/`,
    },
    {
      id: "v2.8",
      name: "v2.8",
      detail: "技能直达与快捷专家",
      href: `${rootPath || ""}/versions/skill-direct-expert-routing/`,
    },
    {
      id: "v2.7",
      name: "v2.7",
      detail: "常用工具切换",
      href: `${rootPath || ""}/versions/common-tools-switcher/`,
    },
    {
      id: "v2.6",
      name: "v2.6",
      detail: "常用专家与技能",
      href: `${rootPath || ""}/versions/common-experts-skills/`,
    },
    {
      id: "v2.5",
      name: "v2.5",
      detail: "猜你想问",
      href: `${rootPath || ""}/versions/question-suggestions/`,
    },
    {
      id: "v2.4",
      name: "v2.4",
      detail: "技能平铺与专家标签",
      href: `${rootPath || ""}/versions/expert-recommendations/`,
    },
    {
      id: "v2.3",
      name: "v2.3",
      detail: "专家技能一体化",
      href: `${rootPath || ""}/versions/integrated-expert-skills/`,
    },
    {
      id: "v2.2",
      name: "v2.2",
      detail: "场景化专家技能",
      href: `${rootPath || ""}/versions/scene-agent-skill/`,
    },
    {
      id: "v2.1",
      name: "v2.1",
      detail: "对商/对内知识隔离",
      href: `${rootPath || ""}/versions/audience-isolation/`,
    },
    {
      id: "v2.0",
      name: "v2.0",
      detail: "基础工作台版",
      href: `${rootPath || ""}/versions/classic/`,
    },
  ];
  const currentId = isClassic
    ? "v2.0"
    : isAudienceIsolation
      ? "v2.1"
      : isSceneAgentSkill
        ? "v2.2"
        : isIntegratedExpertSkills
          ? "v2.3"
          : isExpertRecommendations
            ? "v2.4"
            : isQuestionSuggestions
              ? "v2.5"
              : isCommonExpertsSkills
                ? "v2.6"
                : isCommonToolsSwitcher
                  ? "v2.7"
                  : isSkillDirectExpertRouting
                    ? "v2.8"
                    : isSimplifiedSkillRouting
                      ? "v2.9"
                      : "v2.10";

  const root = document.createElement("div");
  root.id = "trade-agent-version-switcher";
  root.innerHTML = `
    <style>
      #trade-agent-version-switcher {
        position: fixed;
        right: 14px;
        bottom: 14px;
        z-index: 2147483000;
        color: #202124;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      }
      #trade-agent-version-switcher * { box-sizing: border-box; }
      .ta-version-trigger {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        min-height: 30px;
        padding: 0 10px;
        border: 1px solid rgba(255,255,255,.82);
        border-radius: 10px;
        background: rgba(247,248,248,.78);
        box-shadow: 0 4px 14px rgba(25,28,31,.08), inset 0 1px rgba(255,255,255,.72);
        backdrop-filter: blur(16px) saturate(116%);
        -webkit-backdrop-filter: blur(16px) saturate(116%);
        color: #555a60;
        font: inherit;
        font-size: 12px;
        cursor: pointer;
      }
      .ta-version-trigger:hover,
      .ta-version-trigger[aria-expanded="true"] { background: rgba(225,228,230,.9); color: #17191b; }
      .ta-version-trigger:focus-visible,
      .ta-version-option:focus-visible { outline: 2px solid #16191b; outline-offset: 2px; }
      .ta-version-icon { width: 13px; height: 13px; }
      .ta-version-menu {
        position: absolute;
        right: 0;
        bottom: 38px;
        width: 252px;
        padding: 8px;
        border: 1px solid rgba(255,255,255,.82);
        border-radius: 16px;
        background: rgba(247,248,248,.9);
        box-shadow: 0 14px 38px rgba(25,28,31,.14), inset 0 1px rgba(255,255,255,.76);
        backdrop-filter: blur(22px) saturate(118%);
        -webkit-backdrop-filter: blur(22px) saturate(118%);
      }
      .ta-version-menu[hidden] { display: none; }
      .ta-version-title { margin: 4px 7px 7px; color: #777d82; font-size: 12px; }
      .ta-version-option {
        display: grid;
        grid-template-columns: minmax(0,1fr) auto;
        gap: 10px;
        align-items: center;
        min-height: 48px;
        padding: 8px 9px;
        border-radius: 11px;
        color: inherit;
        text-decoration: none;
      }
      .ta-version-option:hover { background: rgba(213,217,220,.56); }
      .ta-version-copy { min-width: 0; }
      .ta-version-name { display: block; overflow: hidden; font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
      .ta-version-detail { display: block; margin-top: 2px; color: #858a8f; font-size: 11px; }
      .ta-version-meta { display: inline-flex; align-items: center; gap: 7px; }
      .ta-version-latest {
        padding: 2px 6px;
        border: 1px solid rgba(1, 169, 170, .2);
        border-radius: 999px;
        background: rgba(1, 193, 194, .12);
        color: #008c8d;
        font-size: 10px;
        font-weight: 700;
        line-height: 1.4;
        white-space: nowrap;
      }
      .ta-version-check { color: #01a9aa; font-size: 14px; font-weight: 700; }
      @media (max-width: 760px) {
        #trade-agent-version-switcher { right: 10px; bottom: 10px; }
        .ta-version-menu { width: min(252px, calc(100vw - 20px)); }
      }
      @media (prefers-reduced-motion: reduce) {
        .ta-version-trigger, .ta-version-option { transition: none; }
      }
    </style>
    <div class="ta-version-menu" id="ta-version-menu" role="menu" hidden>
      <p class="ta-version-title">查看页面版本</p>
      ${versions
        .map(
          (version) => `
            <a class="ta-version-option" href="${version.href}" role="menuitem" ${
              version.id === currentId ? 'aria-current="page"' : ""
            }>
              <span class="ta-version-copy">
                <span class="ta-version-name">${version.name}</span>
                <span class="ta-version-detail">${version.detail}</span>
              </span>
              <span class="ta-version-meta">
                ${version.latest ? '<span class="ta-version-latest">最新版</span>' : ""}
                ${version.id === currentId ? '<span class="ta-version-check" aria-hidden="true">✓</span>' : ""}
              </span>
            </a>`,
        )
        .join("")}
    </div>
    <button class="ta-version-trigger" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="ta-version-menu" title="切换页面版本">
      <svg class="ta-version-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M5 3.25h4.5a2.25 2.25 0 0 1 0 4.5H6.5a2.25 2.25 0 0 0 0 4.5H11M5 3.25 3.25 1.5M5 3.25 3.25 5M11 12.25l1.75-1.75M11 12.25 12.75 14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>版本</span>
    </button>`;

  const trigger = root.querySelector(".ta-version-trigger");
  const menu = root.querySelector(".ta-version-menu");
  const close = () => {
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  };
  const open = () => {
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    const currentVersion = menu.querySelector('[aria-current="page"]');
    if (currentVersion) currentVersion.focus();
  };

  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    if (menu.hidden) open();
    else close();
  });
  root.addEventListener("click", (event) => event.stopPropagation());
  document.addEventListener("click", close);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || menu.hidden) return;
    close();
    trigger.focus();
  });
  document.body.append(root);
})();
