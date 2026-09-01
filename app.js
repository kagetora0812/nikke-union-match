/*
  NIKKE UNION MATCH
  app.js
*/


// ========================================
// Supabase
// ========================================

const SUPABASE_URL =
  "https://igoekrvpgnjberppiawf.supabase.co";

const SUPABASE_ANON_KEY =
  "sb_publishable_xSjnNTnh667o9IesU5g5Kw_xcdg9bbh";

const hasSupabaseConfig =
  !SUPABASE_URL.includes("YOUR_") &&
  !SUPABASE_ANON_KEY.includes("YOUR_");

const sb =
  hasSupabaseConfig &&
  window.supabase
    ? window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
      )
    : null;


// ========================================
// 共通
// ========================================

const $ = selector =>
  document.querySelector(selector);


// ========================================
// Xシェア用
// 直前に登録した募集情報
// ========================================

let lastRegisteredRecruitment = null;

// 登録前プレビューの確定フラグ
let registrationPreviewApproved = false;
let registrationPreviewObjectUrl = null;
let registrationPreviewPreparedFile = null;


function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char])
  );
}


// ========================================
// 募集記事URL
// X / BlablaLink / Discord / その他のHTTP(S) URLに対応
// ========================================

function validRecruitmentUrl(value) {

  try {

    const url =
      new URL(
        String(value || "").trim()
      );

    if (
      url.protocol !== "https:"
      &&
      url.protocol !== "http:"
    ) {
      return false;
    }

    const host =
      url.hostname
        .toLowerCase()
        .replace(/^www\./, "");

    if (
      host === "x.com"
      ||
      host === "twitter.com"
    ) {
      return /^\/[^/]+\/status\/\d+\/?$/
        .test(url.pathname);
    }

    return true;

  } catch {

    return false;

  }

}


function getRecruitmentPlatform(value) {

  try {

    const url =
      new URL(value);

    const host =
      url.hostname
        .toLowerCase()
        .replace(/^www\./, "");

    if (
      host === "x.com"
      ||
      host === "twitter.com"
    ) {
      return "X";
    }

    if (
      host === "blablalink.com"
      ||
      host.endsWith(".blablalink.com")
    ) {
      return "BlablaLink";
    }

    if (
      host === "discord.gg"
      ||
      host === "discord.com"
      ||
      host.endsWith(".discord.com")
    ) {
      return "Discord";
    }

    return "その他";

  } catch {

    return "その他";

  }

}


function isXRecruitmentUrl(value) {
  return getRecruitmentPlatform(value) === "X";
}


function getRecruitmentButtonLabel(value) {

  const platform =
    getRecruitmentPlatform(value);

  if (platform === "X") {
    return "Xで募集記事を開く ↗";
  }

  if (platform === "BlablaLink") {
    return "BlablaLinkで募集記事を開く ↗";
  }

  return "募集記事を開く ↗";
}


// ========================================
// 任意募集画像
// 元画像は20MBまで受付 → ブラウザ側で自動最適化
// Supabaseへは原則1.8MB以下の画像をアップロード
// ========================================

const PREVIEW_SOURCE_MAX_BYTES = 20 * 1024 * 1024;
const PREVIEW_UPLOAD_TARGET_BYTES = 1.8 * 1024 * 1024;
const PREVIEW_MAX_WIDTH = 1920;
const PREVIEW_MAX_HEIGHT = 3200;
const PREVIEW_MAX_PIXELS = 8_000_000;

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0MB";
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function validatePreviewImageFile(file) {

  if (!file) {
    return true;
  }

  const allowedTypes =
    [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

  if (!allowedTypes.includes(file.type)) {
    alert("募集画像は JPG / PNG / WebP を選択してください。");
    return false;
  }

  if (file.size > PREVIEW_SOURCE_MAX_BYTES) {
    alert("募集画像は20MB以下を選択してください。\n大きな画像は選択後に自動で最適化されます。");
    return false;
  }

  return true;
}

function loadPreviewImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("PREVIEW_IMAGE_DECODE_FAILED"));
    };

    image.src = objectUrl;
  });
}

function canvasToPreviewBlob(canvas, mimeType, quality) {
  return new Promise(resolve => {
    canvas.toBlob(resolve, mimeType, quality);
  });
}

function getPreviewResizeScale(width, height) {
  let scale = 1;

  if (width > PREVIEW_MAX_WIDTH) {
    scale = Math.min(scale, PREVIEW_MAX_WIDTH / width);
  }

  if (height > PREVIEW_MAX_HEIGHT) {
    scale = Math.min(scale, PREVIEW_MAX_HEIGHT / height);
  }

  const pixels = width * height;

  if (pixels > PREVIEW_MAX_PIXELS) {
    scale = Math.min(
      scale,
      Math.sqrt(PREVIEW_MAX_PIXELS / pixels)
    );
  }

  return scale;
}

function drawPreviewImageToCanvas(image, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));

  const context = canvas.getContext("2d", { alpha: false });

  if (!context) {
    throw new Error("PREVIEW_CANVAS_UNAVAILABLE");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return canvas;
}

async function optimizePreviewImageFile(file) {
  if (!file) {
    return null;
  }

  if (!validatePreviewImageFile(file)) {
    throw new Error("PREVIEW_IMAGE_INVALID");
  }

  const image = await loadPreviewImage(file);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;

  if (!sourceWidth || !sourceHeight) {
    throw new Error("PREVIEW_IMAGE_SIZE_INVALID");
  }

  const initialScale =
    getPreviewResizeScale(sourceWidth, sourceHeight);

  // サイズ・解像度とも十分小さいJPEG/WebPは画質を落とさずそのまま使う。
  if (
    initialScale === 1 &&
    file.size <= PREVIEW_UPLOAD_TARGET_BYTES &&
    (file.type === "image/jpeg" || file.type === "image/webp")
  ) {
    return file;
  }

  let width = Math.max(1, Math.round(sourceWidth * initialScale));
  let height = Math.max(1, Math.round(sourceHeight * initialScale));

  let bestBlob = null;
  let bestMimeType = "image/webp";

  // 品質を段階的に下げ、それでも大きければ寸法を少しずつ縮小する。
  for (let resizeAttempt = 0; resizeAttempt < 7; resizeAttempt++) {
    const canvas =
      drawPreviewImageToCanvas(image, width, height);

    for (const quality of [0.90, 0.82, 0.74, 0.66, 0.58]) {
      let blob =
        await canvasToPreviewBlob(
          canvas,
          "image/webp",
          quality
        );

      // WebP出力に対応していない環境ではJPEGへフォールバック。
      let mimeType = "image/webp";

      if (!blob || blob.type !== "image/webp") {
        blob =
          await canvasToPreviewBlob(
            canvas,
            "image/jpeg",
            quality
          );
        mimeType = "image/jpeg";
      }

      if (!blob) {
        continue;
      }

      if (!bestBlob || blob.size < bestBlob.size) {
        bestBlob = blob;
        bestMimeType = mimeType;
      }

      if (blob.size <= PREVIEW_UPLOAD_TARGET_BYTES) {
        const extension =
          mimeType === "image/webp" ? "webp" : "jpg";

        return new File(
          [blob],
          `recruitment-preview-${Date.now()}.${extension}`,
          {
            type: mimeType,
            lastModified: Date.now()
          }
        );
      }
    }

    width = Math.max(1, Math.round(width * 0.82));
    height = Math.max(1, Math.round(height * 0.82));
  }

  if (!bestBlob || bestBlob.size > 3 * 1024 * 1024) {
    throw new Error("PREVIEW_IMAGE_OPTIMIZE_FAILED");
  }

  const extension =
    bestMimeType === "image/webp" ? "webp" : "jpg";

  return new File(
    [bestBlob],
    `recruitment-preview-${Date.now()}.${extension}`,
    {
      type: bestMimeType,
      lastModified: Date.now()
    }
  );
}


function buildRecruitmentPreviewMedia(
  url,
  previewImageUrl = "",
  xEmbedEnabled = true
) {

  const platform =
    getRecruitmentPlatform(url);

  if (platform === "X") {

    const postId =
      getXPostId(url);

    if (xEmbedEnabled !== false) {
      return `
        <div
          class="x-embed"
          data-post-id="${escapeHtml(postId || "")}"
        ></div>
      `;
    }

    if (previewImageUrl) {
      return `
        <div class="registration-preview-platform">掲載先：X</div>
        <a
          class="recruitment-preview-link"
          href="${escapeHtml(url)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            class="recruitment-preview-image"
            src="${escapeHtml(previewImageUrl)}"
            alt="X募集記事の登録画像"
            loading="lazy"
          >
        </a>
      `;
    }

    return `
      <div class="x-embed-error">
        <strong>🙈 X埋め込み表示はOFFです</strong><br>
        <span>下のボタンから募集記事を確認できます。</span>
      </div>
    `;
  }

  if (previewImageUrl) {
    return `
      <div class="registration-preview-platform">
        掲載先：${escapeHtml(platform)}
      </div>
      <a
        class="recruitment-preview-link"
        href="${escapeHtml(url)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img
          class="recruitment-preview-image"
          src="${escapeHtml(previewImageUrl)}"
          alt="${escapeHtml(platform)}募集記事の画像"
          loading="lazy"
        >
      </a>
    `;
  }

  return `
    <div class="registration-preview-platform">
      掲載先：${escapeHtml(platform)}
    </div>
    <div class="recruitment-preview-empty">
      画像なし（任意）<br>
      下のボタンから募集記事を確認できます。
    </div>
  `;
}


async function uploadRecruitmentPreviewImage(
  type,
  recruitmentId,
  passHash,
  file
) {

  if (!file) {
    return null;
  }

  const extMap = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  };

  const ext =
    extMap[file.type] || "jpg";

  const safeType =
    type === "union"
      ? "union"
      : "commander";

  const objectPath =
    `${safeType}/${recruitmentId}/${Date.now()}.${ext}`;

  const { error: uploadError } =
    await sb.storage
      .from("recruitment-previews")
      .upload(
        objectPath,
        file,
        {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type
        }
      );

  if (uploadError) {
    throw uploadError;
  }

  const { data: publicData } =
    sb.storage
      .from("recruitment-previews")
      .getPublicUrl(objectPath);

  const publicUrl =
    publicData?.publicUrl || "";

  if (!publicUrl) {
    throw new Error("PREVIEW_PUBLIC_URL_FAILED");
  }

  const { error: attachError } =
    await sb.rpc(
      "set_recruitment_preview_image",
      {
        p_type: safeType,
        p_id: recruitmentId,
        p_pass_hash: passHash,
        p_preview_image_url: publicUrl
      }
    );

  if (attachError) {
    throw attachError;
  }

  return publicUrl;
}


// ========================================
// 日付
// ========================================

function formatDate(date) {

  return new Intl.DateTimeFormat(
    "ja-JP",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }
  ).format(
    new Date(date)
  );

}

// ========================================
// 表示テストモード
// ?badgeTest=1    → NEW + 締切間近を両方表示
// ?newTest=1      → NEWだけ強制表示
// ?deadlineTest=1 → 締切間近だけ強制表示
// ※本番の判定ロジックには影響しません
// ========================================

const displayTestParams =
  new URLSearchParams(
    window.location.search
  );

const forceNewBadge =
  displayTestParams.get("badgeTest") === "1"
  ||
  displayTestParams.get("newTest") === "1";

const forceDeadlineBadge =
  displayTestParams.get("badgeTest") === "1"
  ||
  displayTestParams.get("deadlineTest") === "1";


// ========================================
// NEW表示
// 登録から24時間以内
// ========================================

function isNewRecruitment(createdAt) {

  if (forceNewBadge) {
    return true;
  }

  const createdTime =
    new Date(createdAt).getTime();

  if (!Number.isFinite(createdTime)) {
    return false;
  }

  const diff =
    Date.now() - createdTime;

  return (
    diff >= 0 &&
    diff < 24 * 60 * 60 * 1000
  );

}

// ========================================
// ユニオンランク色分け
// ========================================

function getUnionRankClass(rank) {

  const classes = {

    "チャレンジャー":
      "challenger",

    "ダイヤ":
      "diamond",

    "プラチナ":
      "platinum",

    "ゴールド":
      "gold",

    "シルバー":
      "silver",

    "駆け出しユニオン":
      "rookie"

  };

  return classes[rank] ||
    "default";

}


// ========================================
// PASS生成
// 8文字
// ========================================

function generatePass() {

  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  const random =
    new Uint32Array(8);

  crypto.getRandomValues(
    random
  );

  return Array.from(
    random,
    number =>
      chars[
        number % chars.length
      ]
  ).join("");

}


// ========================================
// PASSハッシュ
// ========================================

async function sha256(text) {

  const data =
    new TextEncoder()
      .encode(text);

  const hash =
    await crypto.subtle.digest(
      "SHA-256",
      data
    );

  return Array.from(
    new Uint8Array(hash)
  )
    .map(
      byte =>
        byte
          .toString(16)
          .padStart(
            2,
            "0"
          )
    )
    .join("");

}


// ========================================
// Supabaseエラーを文字列化
// ========================================

function getErrorText(error) {

  if (!error) {
    return "";
  }

  return [

    error.message,
    error.details,
    error.hint,
    error.code

  ]
    .filter(Boolean)
    .join(" ");

}


// ========================================
// X投稿ID取得
// X / Twitter のURLだけ対象
// ========================================

function getXPostId(value) {

  try {

    const parsed =
      new URL(value);

    const host =
      parsed.hostname
        .toLowerCase()
        .replace(/^www\./, "");

    if (
      host !== "x.com"
      &&
      host !== "twitter.com"
    ) {
      return null;
    }

    const match =
      parsed.pathname.match(
        /\/status\/(\d+)/
      );

    return match
      ? match[1]
      : null;

  } catch {

    return null;

  }

}


// ========================================
// X投稿埋め込み
// 各投稿を独立・並列で読み込む
// 1件が削除済み / Not found でも
// 他の投稿の読み込みを止めない
// ========================================

function showXEmbedFallback(target) {

  if (!target) {
    return;
  }

  target.dataset.loaded =
    "failed";

  target.innerHTML =
    '<div class="x-embed-error">' +
      '<strong>X投稿を埋め込み表示できません</strong><br>' +
      '<span>下の「Xで募集記事を開く」から確認してください。</span>' +
    '</div>';

}


function renderSingleXEmbed(target) {

  if (!target) {
    return;
  }


  if (
    target.dataset.loaded === "true"
    ||
    target.dataset.loaded === "loading"
  ) {
    return;
  }


  const postId =
    target.dataset.postId;


  if (!postId) {

    showXEmbedFallback(
      target
    );

    return;

  }


  target.dataset.loaded =
    "loading";


  try {

    const result =
      window.twttr.widgets
        .createTweet(

          postId,

          target,

          {
            theme: "dark",
            align: "center",
            conversation: "none"
          }

        );


    Promise
      .resolve(result)
      .then(tweetElement => {

        if (tweetElement) {

          target.dataset.loaded =
            "true";

          return;

        }

        showXEmbedFallback(
          target
        );

      })
      .catch(error => {

        console.error(
          "X投稿表示エラー",
          error
        );

        showXEmbedFallback(
          target
        );

      });

  } catch (error) {

    console.error(
      "X投稿表示エラー",
      error
    );

    showXEmbedFallback(
      target
    );

  }

}


function renderXEmbeds(
  retry = 0
) {

  if (
    !window.twttr
    ||
    !window.twttr.widgets
  ) {

    if (retry < 10) {

      setTimeout(
        () => {

          renderXEmbeds(
            retry + 1
          );

        },
        500
      );

    }

    return;
  }


  const targets =
    document.querySelectorAll(
      ".x-embed"
    );


  // ★ await で1件ずつ待たない。
  // 全投稿をそれぞれ独立して読み込む。
  targets.forEach(target => {
    renderSingleXEmbed(target);
  });

}


// ========================================
// ページ切替
//
// ★重要
// プログラムから一覧へ戻った場合も
// 登録・締切モードを確実に解除
// ========================================

function showPage(name) {

  // 登録・締切モード
  document.body.classList.toggle(
    "register-mode",
    name === "register"
  );

  document.body.classList.toggle(
    "manage-mode",
    name === "manage"
  );


  // 全ページを一旦閉じる
  document
    .querySelectorAll(".page")
    .forEach(page => {
      page.classList.remove("active");
    });


  // 登録・締切ページも確実に閉じる
  const registerPage =
    document.getElementById("registerPage");

  const managePage =
    document.getElementById("managePage");

  registerPage?.classList.remove("active");
  managePage?.classList.remove("active");


  // 指定ページだけ開く
  const page =
    document.getElementById(`${name}Page`);

  if (page) {
    page.classList.add("active");
  }


  // 募集一覧へ戻る時は
  // 登録・締切を完全に解除
  if (name === "list") {

    document.body.classList.remove(
      "register-mode",
      "manage-mode"
    );

    registerPage?.classList.remove("active");
    managePage?.classList.remove("active");
  }


  // 下部ナビ
  document
    .querySelectorAll(".nav-btn")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.page === name
      );

    });


  // 募集一覧
  if (name === "list") {

    loadRecruitments();

    setTimeout(() => {

      const listPage =
        document.getElementById("listPage");

      if (!listPage) {
        return;
      }

      const headerOffset = 76;

      const targetTop =
        listPage.getBoundingClientRect().top +
        window.pageYOffset -
        headerOffset;

      window.scrollTo({
        top: Math.max(0, targetTop),
        behavior: "smooth"
      });

    }, 120);

  } else {

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  }
}


// ========================================
// ページボタン
// ========================================

document
  .querySelectorAll(
    "[data-page]"
  )
  .forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          showPage(
            button.dataset.page
          );

        }
      );

    }
  );


// ========================================
// 指揮官 / ユニオン検索タブ
// ========================================

let currentSearchType =
  "commander";


const commanderSearchTab =
  $("#commanderSearchTab");

const unionSearchTab =
  $("#unionSearchTab");

const commanderFilterBox =
  $("#commanderFilterBox");

const unionFilterBox =
  $("#unionFilterBox");


function setSearchType(type) {

  currentSearchType =
    type;


  const isCommander =
    type ===
    "commander";


  commanderSearchTab
    ?.classList
    .toggle(
      "active",
      isCommander
    );


  unionSearchTab
    ?.classList
    .toggle(
      "active",
      !isCommander
    );


  commanderFilterBox
    ?.classList
    .toggle(
      "hidden",
      !isCommander
    );


  unionFilterBox
    ?.classList
    .toggle(
      "hidden",
      isCommander
    );


  loadRecruitments();

}


commanderSearchTab
  ?.addEventListener(
    "click",
    () => {

      setSearchType(
        "commander"
      );

    }
  );


unionSearchTab
  ?.addEventListener(
    "click",
    () => {

      setSearchType(
        "union"
      );

    }
  );


// ========================================
// カウントダウン
// ========================================

let countdownTimer =
  null;


function getRemainingTime(
  expiresAt
) {

  const diff =
    new Date(
      expiresAt
    ).getTime()
    -
    Date.now();


  if (
    diff <=
    0
  ) {

    return {

      expired:
        true,

      text:
        "掲載終了",

      className:
        "danger",

      deadlineNear:
        false

    };

  }


  // ======================================
  // 締切間近 表示テスト
  // 実際の期限を変更せず、見た目だけ強制表示
  // ======================================
  if (forceDeadlineBadge) {

    return {

      expired:
        false,

      text:
        "⚠ 残り 23時間 59分",

      className:
        "deadline-near",

      deadlineNear:
        true

    };

  }


  const totalMinutes =
    Math.floor(
      diff / 60000
    );


  const days =
    Math.floor(
      totalMinutes /
      1440
    );


  const hours =
    Math.floor(
      (
        totalMinutes %
        1440
      )
      /
      60
    );


  const minutes =
    totalMinutes %
    60;


  // ======================================
  // 締切間近：残り24時間以内
  // ======================================
  const deadlineNear =
    diff <=
    24 * 60 * 60 * 1000;


  if (deadlineNear) {

    return {

      expired:
        false,

      text:
        `⚠ 残り ${hours}時間 ${minutes}分`,

      className:
        "deadline-near",

      deadlineNear:
        true

    };

  }


  let className =
    "";


  if (
    days <=
    2
  ) {

    className =
      "danger";


  } else if (
    days <=
    6
  ) {

    className =
      "warning";

  }


  return {

    expired:
      false,

    text:
      `⏳ 残り ${days}日 ${hours}時間 ${minutes}分`,

    className,

    deadlineNear:
      false

  };

}


function updateCountdowns() {

  document
    .querySelectorAll(
      "[data-expires]"
    )
    .forEach(
      element => {

        const result =
          getRemainingTime(
            element.dataset.expires
          );


        if (
          result.expired
        ) {

          const card =
            element.closest(
              ".card"
            );


          if (card) {

            card.remove();

          }


          return;

        }


        element.textContent =
          result.text;


        element.className =
          `countdown ${result.className}`;


        // ======================================
        // 締切間近バッジを1分ごとに同期
        // ======================================
        const card =
          element.closest(
            ".card"
          );

        const badgeWrap =
          card
            ?.querySelector(
              ".type-with-new"
            );

        const currentBadge =
          badgeWrap
            ?.querySelector(
              ".deadline-badge"
            );

        if (
          result.deadlineNear
        ) {

          if (
            badgeWrap &&
            !currentBadge
          ) {

            badgeWrap
              .insertAdjacentHTML(
                "beforeend",
                '<span class="deadline-badge">⚠ 締切間近</span>'
              );

          }

        } else {

          currentBadge
            ?.remove();

        }

      }
    );

}


// ========================================
// メッセージ
// ========================================

function showMessage(
  text,
  type = ""
) {

  const message =
    $("#message");


  if (!message) {
    return;
  }


  message.textContent =
    text;


  message.className =
    `message ${type}`;

}


// ========================================
// 空表示
// ========================================

function showEmpty(text) {

  const empty =
    $("#emptyState");


  if (!empty) {
    return;
  }


  empty.classList.remove(
    "hidden"
  );


  const p =
    empty.querySelector(
      "p"
    );


  if (p) {

    p.textContent =
      text;

  }

}


// ========================================
// 卒業ちしかんカウンター
//
// PASS締切
// +
// 14日経過
//
// Supabase側で合算
// ========================================

async function loadGraduatedCommanderCount() {

  const counter =
    $("#graduatedCommanderCount");

  const topCounter =
    $("#graduatedCommanderCountTop");


  if (!sb) {

    return null;

  }


  const {
    data,
    error
  } =
    await sb.rpc(
      "get_graduated_commander_count"
    );


  if (error) {

    console.error(
      "卒業ちしかんカウンター取得エラー",
      error
    );

    return null;

  }


  const count =
    Number(
      Array.isArray(data)
        ? data[0]
        : data
    );


  if (
    !Number.isFinite(
      count
    )
  ) {

    return null;

  }


  // 下側が残っている場合だけ更新
  if (counter) {

    counter.textContent =
      count;

  }


  // TOP側
  if (topCounter) {

    topCounter.textContent =
      count;

  }


  return count;

}


// ========================================
// Xシェア用
// 現在募集中の指揮官数
// ========================================

async function getCurrentCommanderCount() {

  if (!sb) {

    return 0;

  }


  const {
    count,
    error
  } =
    await sb
      .from(
        "recruitments"
      )
      .select(
        "id",
        {
          count: "exact",
          head: true
        }
      )
      .eq(
        "status",
        "open"
      )
      .gt(
        "expires_at",
        new Date()
          .toISOString()
      );


  if (error) {

    console.error(
      "登録指揮官数取得エラー",
      error
    );


    return Number(

      $("#commanderCountTop")
        ?.textContent
      ||
      $("#commanderCount")
        ?.textContent
      ||
      0

    );

  }


  return Number(
    count || 0
  );

}


// ========================================
// Xシェア用
// 現在募集中のユニオン数
// ========================================

async function getCurrentUnionCount() {

  if (!sb) {

    return 0;

  }


  const {
    count,
    error
  } =
    await sb
      .from(
        "union_recruitments"
      )
      .select(
        "id",
        {
          count: "exact",
          head: true
        }
      )
      .eq(
        "status",
        "open"
      )
      .gt(
        "expires_at",
        new Date()
          .toISOString()
      );


  if (error) {

    console.error(
      "登録ユニオン数取得エラー",
      error
    );


    return Number(

      $("#unionCountTop")
        ?.textContent
      ||
      $("#unionCount")
        ?.textContent
      ||
      0

    );

  }


  return Number(
    count || 0
  );

}


// ========================================
// Xシェア文
//
// 通常Xアカウント用
// 短縮版
// ========================================

function buildXShareText(
  registration,
  commanderCount,
  unionCount,
  graduatedCount
) {

  if (!registration) {

    return "";

  }


  const commonTop =

    "🔎 指揮官とユニオンをつなぐマッチングアプリ\n" +
    "「NIKKE UNION MATCH」に募集登録しました！\n\n";


  const commonStats =

    "📊 現在の登録状況\n" +
    `👤 ${commanderCount}名\n` +
    `🏢 ${unionCount}\n` +
    `🎓 ${graduatedCount}名\n\n`;


  const appUrl =
    "https://x.gd/4tEJo";


  // ======================================
  // 指揮官
  // ======================================

  if (
    registration.type ===
    "commander"
  ) {

    return (

      commonTop +

      `👤 ${registration.name}\n` +
      `⚡ ${registration.slv}\n\n` +

      commonStats +

      "👇 UNION MATCH\n" +
      appUrl +
      "\n\n" +

      "👇 募集投稿\n" +
      registration.xUrl

    );

  }


  // ======================================
  // ユニオン
  // ======================================

  return (

    commonTop +

    `🏢 ${registration.name}\n` +
    `🏆 ${registration.rank}\n\n` +

    commonStats +

    "👇 UNION MATCH\n" +
    appUrl +
    "\n\n" +

    "👇 募集投稿\n" +
    registration.xUrl

  );

}


// ========================================
// 募集一覧
// ========================================

async function loadRecruitments() {

  const list =
    $("#recruitmentList");

  const empty =
    $("#emptyState");


  if (
    !list ||
    !empty
  ) {

    return;

  }


  if (!sb) {

    showMessage(

      "Supabaseの設定がまだです。",

      "error"

    );

    return;

  }


  list.innerHTML =
    "";


  empty.classList.add(
    "hidden"
  );


  // 卒業ちしかん更新

  await loadGraduatedCommanderCount();


  // ======================================
  // 指揮官取得
  // ======================================

  const commanderQuery =

    sb
      .from(
        "recruitments"
      )
      .select(
        "id, commander_name, slv, x_url, x_embed_enabled, preview_image_url, created_at, expires_at"
      )
      .eq(
        "status",
        "open"
      )
      .gt(
        "expires_at",
        new Date()
          .toISOString()
      )
      .order(
        "created_at",
        {
          ascending:
            false
        }
      );


  // ======================================
  // ユニオン取得
  // ======================================

  const unionQuery =

    sb
      .from(
        "union_recruitments"
      )
      .select(
        "id, union_name, union_rank, x_url, x_embed_enabled, preview_image_url, created_at, expires_at"
      )
      .eq(
        "status",
        "open"
      )
      .gt(
        "expires_at",
        new Date()
          .toISOString()
      )
      .order(
        "created_at",
        {
          ascending:
            false
        }
      );


  const [

    commanderResult,
    unionResult

  ] =

    await Promise.all([

      commanderQuery,
      unionQuery

    ]);


  // ======================================
  // エラー
  // ======================================

  if (
    commanderResult.error
  ) {

    showMessage(

      `指揮官読み込みエラー：${commanderResult.error.message}`,

      "error"

    );

    return;

  }


  if (
    unionResult.error
  ) {

    showMessage(

      `ユニオン読み込みエラー：${unionResult.error.message}`,

      "error"

    );

    return;

  }


  const commanders =
    commanderResult.data ||
    [];


  const unions =
    unionResult.data ||
    [];


  // ======================================
  // カウンター
  // ======================================

  if (
    $("#commanderCountTop")
  ) {

    $("#commanderCountTop")
      .textContent =
      commanders.length;

  }


  if (
    $("#unionCountTop")
  ) {

    $("#unionCountTop")
      .textContent =
      unions.length;

  }


  if (
    $("#commanderCount")
  ) {

    $("#commanderCount")
      .textContent =
      commanders.length;

  }


  if (
    $("#unionCount")
  ) {

    $("#unionCount")
      .textContent =
      unions.length;

  }


  // ======================================
  // 最終更新
  // ======================================

  if (
    $("#lastUpdated")
  ) {

    $("#lastUpdated")
      .textContent =

      "最終更新：" +

      new Intl.DateTimeFormat(
        "ja-JP",
        {

          month:
            "2-digit",

          day:
            "2-digit",

          hour:
            "2-digit",

          minute:
            "2-digit"

        }
      ).format(
        new Date()
      );

  }


  // ======================================
  // 指揮官一覧
  // ======================================

  if (
    currentSearchType ===
    "commander"
  ) {

    const minSlv =
      Number(
        $("#slvFilter")
          ?.value ||
        0
      );


    let filtered =
      [
        ...commanders
      ];


    if (
      minSlv >
      0
    ) {

      filtered =
        filtered.filter(
          item => {

            const slv =
              Number(
                item.slv
              );


            if (
              minSlv ===
              1000
            ) {

              return (

                slv >=
                1000

                &&

                slv <=
                1200

              );

            }


            return (

              slv >=
              minSlv

              &&

              slv <=
              minSlv + 99

            );

          }
        );

    }


    filtered.sort(

      (a, b) =>

        new Date(
          b.created_at
        )
        -
        new Date(
          a.created_at
        )

    );


    if (
      filtered.length ===
      0
    ) {

      showEmpty(
        "現在募集中の指揮官はいません。"
      );

      return;

    }


    list.innerHTML =

      filtered
        .map(
          item => {


            const remaining =
              getRemainingTime(
                item.expires_at
              );


            const postId =
              getXPostId(
                item.x_url
              );

const newBadge =
  isNewRecruitment(
    item.created_at
  )
    ? '<span class="new-badge">🔥 NEW</span>'
    : "";

const deadlineBadge =
  remaining.deadlineNear
    ? '<span class="deadline-badge">⚠ 締切間近</span>'
    : "";
            return `

              <article
                class="card commander-card"
              >

                <div class="card-head">

                <div class="type-with-new">

  <span
    class="recruitment-type"
  >
    ● 指揮官
  </span>

  ${newBadge}
  ${deadlineBadge}

</div>

<span class="date">
                    期限

                    ${formatDate(
                      item.expires_at
                    )}

                  </span>

                </div>


                <div class="name">

                  ${escapeHtml(
                    item.commander_name
                  )}

                </div>


                <div class="slv">

                  ${escapeHtml(
                    item.slv
                  )}

                  <small
                    class="slv-label"
                    style="color:#7b8085 !important;-webkit-text-fill-color:#7b8085 !important;text-shadow:none !important;-webkit-text-stroke:0 !important;"
                  >
                    SLV
                  </small>

                </div>


                <div class="date">

                  登録

                  ${formatDate(
                    item.created_at
                  )}

                </div>


                <div
                  class="countdown ${remaining.className}"
                  data-expires="${escapeHtml(
                    item.expires_at
                  )}"
                >

                  ${remaining.text}

                </div>


                <div class="x-post-area">

                  ${buildRecruitmentPreviewMedia(
                    item.x_url,
                    item.preview_image_url || "",
                    item.x_embed_enabled
                  )}


                  <a

                    class="x-btn"

                    href="${escapeHtml(
                      item.x_url
                    )}"

                    target="_blank"

                    rel="noopener noreferrer"

                  >

                    ${escapeHtml(
                      getRecruitmentButtonLabel(
                        item.x_url
                      )
                    )}

                  </a>


                </div>


              </article>

            `;

          }
        )
        .join("");

  }


  // ======================================
  // ユニオン一覧
  // ======================================

  if (
    currentSearchType ===
    "union"
  ) {

    const selectedRank =

      $("#unionRankFilter")
        ?.value
      ||
      "";


    let filtered =
      [
        ...unions
      ];


    if (
      selectedRank
    ) {

      filtered =
        filtered.filter(
          item =>
            item.union_rank ===
            selectedRank
        );

    }


    filtered.sort(

      (a, b) =>

        new Date(
          b.created_at
        )
        -
        new Date(
          a.created_at
        )

    );


    if (
      filtered.length ===
      0
    ) {

      showEmpty(
        "現在募集中のユニオンはいません。"
      );

      return;

    }


    list.innerHTML =

      filtered
        .map(
          item => {


            const remaining =
              getRemainingTime(
                item.expires_at
              );


            const postId =
              getXPostId(
                item.x_url
              );


            const rankClass =
              getUnionRankClass(
                item.union_rank
              );

const newBadge =
  isNewRecruitment(
    item.created_at
  )
    ? '<span class="new-badge">🔥 NEW</span>'
    : "";

const deadlineBadge =
  remaining.deadlineNear
    ? '<span class="deadline-badge">⚠ 締切間近</span>'
    : "";
            
            return `

              <article
                class="card union-card"
              >

                <div class="card-head">


                <div class="type-with-new">

  <span
    class="recruitment-type"
  >
    ● ユニオン
  </span>

  ${newBadge}
  ${deadlineBadge}

</div>

<span class="date">

                    期限

                    ${formatDate(
                      item.expires_at
                    )}

                  </span>


                </div>


                <div class="name">

                  ${escapeHtml(
                    item.union_name
                  )}

                </div>


                <div
                  class="union-rank rank-${rankClass}"
                >

                  ${escapeHtml(
                    item.union_rank
                  )}

                </div>


                <div class="date">

                  登録

                  ${formatDate(
                    item.created_at
                  )}

                </div>


                <div
                  class="countdown ${remaining.className}"
                  data-expires="${escapeHtml(
                    item.expires_at
                  )}"
                >

                  ${remaining.text}

                </div>


                <div class="x-post-area">

                  ${buildRecruitmentPreviewMedia(
                    item.x_url,
                    item.preview_image_url || "",
                    item.x_embed_enabled
                  )}


                  <a

                    class="x-btn"

                    href="${escapeHtml(
                      item.x_url
                    )}"

                    target="_blank"

                    rel="noopener noreferrer"

                  >

                    ${escapeHtml(
                      getRecruitmentButtonLabel(
                        item.x_url
                      )
                    )}

                  </a>


                </div>


              </article>

            `;

          }
        )
        .join("");

  }


  updateCountdowns();


  renderXEmbeds();


  if (
    countdownTimer
  ) {

    clearInterval(
      countdownTimer
    );

  }


  countdownTimer =

    setInterval(

      updateCountdowns,

      60000

    );

}


// ========================================
// フィルター
// ========================================

$("#slvFilter")
  ?.addEventListener(
    "change",
    loadRecruitments
  );


$("#unionRankFilter")
  ?.addEventListener(
    "change",
    loadRecruitments
  );


$("#refreshBtn")
  ?.addEventListener(
    "click",
    loadRecruitments
  );


// ========================================
// 登録タイプ切り替え
// ========================================

const registrationTypeSelect =
  $("#registrationType");


const commanderFields =
  $("#commanderFields");


const unionFields =
  $("#unionFields");


function updateRegistrationFields() {

  if (
    !registrationTypeSelect
  ) {

    return;

  }


  const isUnion =

    registrationTypeSelect
      .value ===
    "union";


  commanderFields
    ?.classList
    .toggle(

      "hidden",

      isUnion

    );


  unionFields
    ?.classList
    .toggle(

      "hidden",

      !isUnion

    );


  const name =
    $("#name");


  const slv =
    $("#slv");


  const unionName =
    $("#unionName");


  if (name) {

    name.required =
      !isUnion;

  }


  if (slv) {

    slv.required =
      !isUnion;

  }


  if (unionName) {

    unionName.required =
      isUnion;

  }

}


registrationTypeSelect
  ?.addEventListener(
    "change",
    updateRegistrationFields
  );


updateRegistrationFields();


// ========================================
// 登録前プレビュー
// ========================================

function closeRegistrationPreview(keepPreparedFile = false) {

  $("#registrationPreviewModal")
    ?.classList
    .add("hidden");

  if (registrationPreviewObjectUrl) {
    URL.revokeObjectURL(registrationPreviewObjectUrl);
    registrationPreviewObjectUrl = null;
  }

  if (!keepPreparedFile) {
    registrationPreviewPreparedFile = null;
  }
}


async function showRegistrationPreview() {

  const registrationType =
    $("#registrationType")?.value || "commander";

  const xUrl =
    $("#xUrl")?.value.trim() || "";

  if (!validRecruitmentUrl(xUrl)) {
    alert("募集記事URLを入力してください。\nX・BlablaLink・DiscordなどのURLに対応しています。");
    return false;
  }

  const previewFile =
    $("#previewImage")?.files?.[0] || null;

  if (!validatePreviewImageFile(previewFile)) {
    return false;
  }

  let name = "";
  let detail = "";
  let cardClass = "commander-card";
  let typeLabel = "● 指揮官";

  if (registrationType === "union") {
    name = $("#unionName")?.value.trim() || "";
    detail = $("#unionRank")?.value || "";
    cardClass = "union-card";
    typeLabel = "● ユニオン";

    if (!name) {
      alert("ユニオン名を入力してください。");
      return false;
    }
  } else {
    name = $("#name")?.value.trim() || "";
    const slv = Number($("#slv")?.value);

    if (!name) {
      alert("指揮官名を入力してください。");
      return false;
    }

    if (!slv || slv < 1 || slv > 1200) {
      alert("SLVは1～1200で入力してください。");
      return false;
    }

    detail = `${slv} <small class="slv-label" style="color:#7b8085 !important;-webkit-text-fill-color:#7b8085 !important;text-shadow:none !important;-webkit-text-stroke:0 !important;">SLV</small>`;
  }

  if (registrationPreviewObjectUrl) {
    URL.revokeObjectURL(registrationPreviewObjectUrl);
    registrationPreviewObjectUrl = null;
  }

  registrationPreviewPreparedFile = null;

  if (previewFile) {
    const previewButton = $("#registerPreviewBtn");
    const originalButtonText = previewButton?.textContent || "登録内容を確認する";

    if (previewButton) {
      previewButton.disabled = true;
      previewButton.textContent = "画像を自動最適化中...";
    }

    try {
      registrationPreviewPreparedFile =
        await optimizePreviewImageFile(previewFile);

      registrationPreviewObjectUrl =
        URL.createObjectURL(registrationPreviewPreparedFile);

      const status = $("#previewImageStatus");

      if (status) {
        status.textContent =
          previewFile === registrationPreviewPreparedFile
            ? `選択画像：${formatFileSize(previewFile.size)}（そのまま使用できます）`
            : `自動最適化：${formatFileSize(previewFile.size)} → ${formatFileSize(registrationPreviewPreparedFile.size)}`;
      }
    } catch (error) {
      console.error("募集画像の自動最適化エラー", error);
      registrationPreviewPreparedFile = null;

      alert(
        "画像を自動最適化できませんでした。\n別のJPG / PNG / WebP画像を選択してください。"
      );

      return false;
    } finally {
      if (previewButton) {
        previewButton.disabled = false;
        previewButton.textContent = originalButtonText;
      }
    }
  }

  const platform =
    getRecruitmentPlatform(xUrl);

  const mediaHtml =
    buildRecruitmentPreviewMedia(
      xUrl,
      registrationPreviewObjectUrl || "",
      true
    );

  const detailHtml =
    registrationType === "union"
      ? `<div class="union-rank rank-${escapeHtml(getUnionRankClass(detail))}">${escapeHtml(detail)}</div>`
      : `<div class="slv">${detail}</div>`;

  const host =
    $("#registrationPreviewCard");

  if (!host) {
    return false;
  }

  host.innerHTML = `
    <article class="card ${cardClass}">
      <div class="card-head">
        <div class="type-with-new">
          <span class="recruitment-type">${typeLabel}</span>
          <span class="new-badge">🔥 NEW</span>
        </div>
        <span class="date">期限 14日後</span>
      </div>

      <div class="name">${escapeHtml(name)}</div>
      ${detailHtml}
      ${platform === "X" ? '<div class="date">掲載先：X</div>' : ""}
      <div class="countdown">残り14日</div>

      <div class="x-post-area">
        ${mediaHtml}

        <a
          class="x-btn"
          href="${escapeHtml(xUrl)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          ${escapeHtml(getRecruitmentButtonLabel(xUrl))}
        </a>
      </div>
    </article>
  `;

  $("#registrationPreviewModal")
    ?.classList
    .remove("hidden");

  if (isXRecruitmentUrl(xUrl)) {
    setTimeout(renderXEmbeds, 0);
  }

  return true;
}


$("#registrationPreviewBack")
  ?.addEventListener("click", () => closeRegistrationPreview(false));

$("#registrationPreviewClose")
  ?.addEventListener("click", () => closeRegistrationPreview(false));

$("#registrationPreviewModal")
  ?.addEventListener(
    "click",
    event => {
      if (event.target?.id === "registrationPreviewModal") {
        closeRegistrationPreview(false);
      }
    }
  );

$("#registrationPreviewConfirm")
  ?.addEventListener(
    "click",
    () => {
      registrationPreviewApproved = true;
      closeRegistrationPreview(true);
      $("#registerForm")?.requestSubmit();
    }
  );


$("#previewImage")
  ?.addEventListener(
    "change",
    event => {
      registrationPreviewApproved = false;
      registrationPreviewPreparedFile = null;

      if (registrationPreviewObjectUrl) {
        URL.revokeObjectURL(registrationPreviewObjectUrl);
        registrationPreviewObjectUrl = null;
      }

      const file = event.target?.files?.[0] || null;
      const status = $("#previewImageStatus");

      if (!file) {
        if (status) {
          status.textContent = "";
        }
        return;
      }

      if (!validatePreviewImageFile(file)) {
        event.target.value = "";
        if (status) {
          status.textContent = "";
        }
        return;
      }

      if (status) {
        status.textContent =
          `選択画像：${formatFileSize(file.size)} / 20MBまで（確認時に自動最適化）`;
      }
    }
  );


// ========================================
// 登録結果表示
// ========================================

function showRegistrationResult(
  pass,
  result
) {


  if (
    $("#passValue")
  ) {

    $("#passValue")
      .textContent =
      pass;

  }


  if (
    $("#resultExpiry")
  ) {

    $("#resultExpiry")
      .textContent =

      formatDate(
        result.expires_at
      );

  }


  const resultId =
    $("#resultId");


  if (resultId) {

    const row =
      resultId.closest(
        ".result-row"
      );


    if (row) {

      row.style.display =
        "none";

    }

  }


  $("#resultModal")
    ?.classList
    .remove(
      "hidden"
    );

}


// ========================================
// 募集登録
// ========================================

$("#registerForm")
  ?.addEventListener(
    "submit",
    async event => {


      event.preventDefault();


      if (!registrationPreviewApproved) {

        await showRegistrationPreview();
        return;

      }

      registrationPreviewApproved = false;


      if (!sb) {

        alert(
          "Supabaseの設定がまだです。"
        );

        return;

      }


      const registrationType =

        $("#registrationType")
          ?.value
        ||
        "commander";


      const xUrl =

        $("#xUrl")
          ?.value
          .trim();


      const originalPreviewFile =
        $("#previewImage")
          ?.files?.[0]
        ||
        null;

      const previewFile =
        registrationPreviewPreparedFile || originalPreviewFile;


      if (!validatePreviewImageFile(originalPreviewFile)) {
        return;
      }


      if (
        !validRecruitmentUrl(
          xUrl
        )
      ) {

        alert(
          "募集記事URLを入力してください。\nX・BlablaLink・DiscordなどのURLに対応しています。"
        );

        return;

      }


      // ======================================
      // ユニオン登録
      // ======================================

      if (
        registrationType ===
        "union"
      ) {


        const unionName =

          $("#unionName")
            ?.value
            .trim();


        const unionRank =

          $("#unionRank")
            ?.value;


        if (!unionName) {

          alert(
            "ユニオン名を入力してください。"
          );

          return;

        }


        for (

          let attempt = 0;

          attempt < 5;

          attempt++

        ) {


          const pass =
            generatePass();


          const passHash =
            await sha256(
              pass
            );


          const {
            data,
            error
          } =

            await sb.rpc(

              "create_union_recruitment_url",

              {

                p_union_name:
                  unionName,

                p_union_rank:
                  unionRank,

                p_x_url:
                  xUrl,

                p_pass_hash:
                  passHash

              }

            );


          if (error) {


            const errorText =
              getErrorText(
                error
              );


            if (
              errorText.includes(
                "UNION_NAME_DUPLICATE"
              )
            ) {

              alert(
                "同じユニオン名ですでに募集中です。"
              );

              return;

            }


            if (
              errorText.includes(
                "INVALID_RECRUITMENT_URL"
              )
              ||
              errorText.includes(
                "INVALID_X_POST_URL"
              )
            ) {

              alert(
                "募集記事URLが正しくありません。http:// または https:// から始まるURLを入力してください。"
              );

              return;

            }


            if (
              errorText.includes(
                "PASS_DUPLICATE"
              )
            ) {

              continue;

            }


            console.error(
              "ユニオン登録エラー",
              error
            );


            alert(
              `登録に失敗しました：${error.message}`
            );


            return;

          }


          const result =

            Array.isArray(
              data
            )
              ? data[0]
              : data;


          if (previewFile && result?.id) {
            try {
              await uploadRecruitmentPreviewImage(
                "union",
                result.id,
                passHash,
                previewFile
              );
            } catch (previewError) {
              console.error("募集画像アップロードエラー", previewError);
              alert("募集登録は完了しましたが、画像の登録だけ失敗しました。\n募集自体は正常に掲載されています。");
            }
          }


          // ==================================
          // Xシェア用
          // ==================================

          lastRegisteredRecruitment = {

            type:
              "union",

            name:
              unionName,

            rank:
              unionRank,

            xUrl

          };


          showRegistrationResult(
            pass,
            result
          );


          event.target.reset();
          registrationPreviewPreparedFile = null;


          updateRegistrationFields();


          return;

        }


        alert(
          "PASSの発行に失敗しました。もう一度登録してください。"
        );


        return;

      }


      // ======================================
      // 指揮官登録
      // ======================================

      const name =

        $("#name")
          ?.value
          .trim();


      const slv =

        Number(
          $("#slv")
            ?.value
        );


      if (!name) {

        alert(
          "指揮官名を入力してください。"
        );

        return;

      }


      if (
        !slv ||
        slv < 1 ||
        slv > 1200
      ) {

        alert(
          "SLVは1～1200で入力してください。"
        );

        return;

      }


      for (

        let attempt = 0;

        attempt < 5;

        attempt++

      ) {


        const pass =
          generatePass();


        const passHash =
          await sha256(
            pass
          );


        const {
          data,
          error
        } =

          await sb.rpc(

            "create_recruitment_url",

            {

              p_commander_name:
                name,

              p_slv:
                slv,

              p_x_url:
                xUrl,

              p_pass_hash:
                passHash

            }

          );


        if (error) {


          const errorText =
            getErrorText(
              error
            );


          if (
            errorText.includes(
              "COMMANDER_NAME_DUPLICATE"
            )
          ) {

            alert(
              "同じ指揮官名ですでに募集中です。"
            );

            return;

          }


          if (
            errorText.includes(
              "INVALID_RECRUITMENT_URL"
            )
            ||
            errorText.includes(
              "INVALID_X_POST_URL"
            )
          ) {

            alert(
              "募集記事URLが正しくありません。http:// または https:// から始まるURLを入力してください。"
            );

            return;

          }


          if (
            errorText.includes(
              "PASS_DUPLICATE"
            )
          ) {

            continue;

          }


          console.error(
            "指揮官登録エラー",
            error
          );


          alert(
            `登録に失敗しました：${error.message}`
          );


          return;

        }


        const result =

          Array.isArray(
            data
          )
            ? data[0]
            : data;


        if (previewFile && result?.id) {
          try {
            await uploadRecruitmentPreviewImage(
              "commander",
              result.id,
              passHash,
              previewFile
            );
          } catch (previewError) {
            console.error("募集画像アップロードエラー", previewError);
            alert("募集登録は完了しましたが、画像の登録だけ失敗しました。\n募集自体は正常に掲載されています。");
          }
        }


        // ==================================
        // Xシェア用
        // ==================================

        lastRegisteredRecruitment = {

          type:
            "commander",

          name,

          slv,

          xUrl

        };


        showRegistrationResult(
          pass,
          result
        );


        event.target.reset();
        registrationPreviewPreparedFile = null;


        updateRegistrationFields();


        return;

      }


      alert(
        "PASSの発行に失敗しました。もう一度登録してください。"
      );

    }
  );


// ========================================
// PASSコピー
// ========================================

$("#copyPass")
  ?.addEventListener(
    "click",
    async () => {


      const pass =

        $("#passValue")
          ?.textContent
        ||
        "";


      try {


        await navigator
          .clipboard
          .writeText(
            pass
          );


        const button =
          $("#copyPass");


        if (button) {


          button.textContent =
            "コピーしました";


          setTimeout(
            () => {

              button.textContent =
                "PASSをコピー";

            },
            1500
          );

        }


      } catch (error) {


        console.error(
          "PASSコピーエラー",
          error
        );


        alert(
          "PASSをコピーできませんでした。手動で保存してください。"
        );

      }

    }
  );


// ========================================
// 登録完了モーダル
// ========================================

function closeModal() {

  $("#resultModal")
    ?.classList
    .add(
      "hidden"
    );

}


// ×ボタン

$("#modalClose")
  ?.addEventListener(
    "click",
    closeModal
  );


// ========================================
// シェアしないで完了
//
// ★一覧へ戻る
// ★登録フォームを閉じる
// ========================================

$("#resultDone")
  ?.addEventListener(
    "click",
    () => {


      closeModal();


      showPage(
        "list"
      );


    }
  );


// ========================================
// Xで募集をシェア
// ========================================

$("#shareXBtn")
  ?.addEventListener(
    "click",
    async () => {


      if (
        !lastRegisteredRecruitment
      ) {

        alert(
          "登録情報を取得できませんでした。\n募集一覧から登録内容をご確認ください。"
        );

        return;

      }


      // ======================================
      // ボタン操作直後に
      // X用タブを確保
      // ======================================

      const shareWindow =

        window.open(
          "about:blank",
          "_blank"
        );


      // ======================================
      // 最新カウンター取得
      // ======================================

      const [

        commanderCount,
        unionCount,
        graduatedCountResult

      ] =

        await Promise.all([

          getCurrentCommanderCount(),

          getCurrentUnionCount(),

          loadGraduatedCommanderCount()

        ]);


      const graduatedCount =

        Number.isFinite(
          Number(
            graduatedCountResult
          )
        )

          ?

          Number(
            graduatedCountResult
          )

          :

          Number(
            $("#graduatedCommanderCount")
              ?.textContent
            ||
            0
          );


      // ======================================
      // X文章
      // ======================================

      const shareText =

        buildXShareText(

          lastRegisteredRecruitment,

          commanderCount,

          unionCount,

          graduatedCount

        );


      const shareUrl =

        "https://twitter.com/intent/tweet?text="

        +

        encodeURIComponent(
          shareText
        );


      // ======================================
      // X投稿画面
      // ======================================

      if (
        shareWindow
      ) {


        shareWindow.opener =
          null;


        shareWindow.location.href =
          shareUrl;


      } else {


        window.location.href =
          shareUrl;

      }


      // ======================================
      // 元のアプリ側
      // 登録画面を閉じて一覧へ
      // ======================================

      closeModal();


      showPage(
        "list"
      );

    }
  );


// ========================================
// PASSだけで募集締切
// ========================================

$("#closeForm")
  ?.addEventListener(
    "submit",
    async event => {


      event.preventDefault();


      if (!sb) {

        alert(
          "Supabaseの設定がまだです。"
        );

        return;

      }


      const pass =

        $("#closePass")
          ?.value
          .trim()
          .toUpperCase();


      if (!pass) {

        alert(
          "PASSを入力してください。"
        );

        return;

      }


      const hash =

        await sha256(
          pass
        );


      const {
        data,
        error
      } =

        await sb.rpc(

          "close_recruitment_by_pass",

          {

            p_pass_hash:
              hash

          }

        );


      if (error) {


        console.error(
          "募集締切エラー",
          error
        );


        alert(
          "募集締切処理に失敗しました。"
        );


        return;

      }


      // ======================================
      // 指揮官締切
      // 卒業ちしかん +1
      // ======================================

if (
  data ===
  "commander_confirm"
) {

  // 指揮官の募集締切 = ユニオン決定として扱う
  await closeCommanderRecruitment();

  return;

}

      // ======================================
      // ユニオン締切
      // 卒業カウンターには入れない
      // ======================================

      if (
        data ===
        "union"
      ) {


        alert(
          "ユニオン募集を締め切りました。"
        );


        event.target.reset();


        // ★締切画面を閉じて一覧へ

        showPage(
          "list"
        );


        return;

      }


      alert(
        "PASSが正しくないか、すでに募集終了しています。"
      );

    }
  );

// ========================================
// 指揮官募集を締め切る
// 締切 = ユニオン決定（成立実績 +1）
// ========================================

async function closeCommanderRecruitment() {

  if (!sb) {

    alert(
      "Supabaseの設定がまだです。"
    );

    return;

  }


  const pass =
    $("#closePass")
      ?.value
      .trim()
      .toUpperCase();


  if (!pass) {

    alert(
      "PASSを入力してください。"
    );

    return;

  }


  const hash =
    await sha256(
      pass
    );


  const {
    data,
    error
  } =
    await sb.rpc(
      "close_commander_recruitment_by_pass",
      {
        p_pass_hash:
          hash,

        p_close_reason:
          "graduated"
      }
    );


  if (error) {

    console.error(
      "指揮官募集締切エラー",
      error
    );

    alert(
      "指揮官募集の締切処理に失敗しました。"
    );

    return;

  }


  if (data !== true) {

    alert(
      "PASSが正しくないか、すでに募集終了しています。"
    );

    return;

  }


  $("#closeForm")
    ?.reset();


  alert(
    "🎓 ユニオン決定として募集を締め切りました。"
  );


  await loadGraduatedCommanderCount();


  showPage(
    "list"
  );

}


// ========================================
// 起動
// ========================================

setSearchType(
  "commander"
);
