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
// アクセス解析
// 管理画面でPV / ユニーク数を確認するため、
// 公開サイトを開いた時に1回だけ記録します。
// ========================================

const ACCESS_VISITOR_KEY =
  "nikke_union_match_visitor_v1";


function getOrCreateAccessVisitorId() {

  try {

    let visitorId =
      localStorage.getItem(
        ACCESS_VISITOR_KEY
      );

    if (visitorId) {
      return visitorId;
    }

    if (
      window.crypto
      &&
      typeof window.crypto.randomUUID === "function"
    ) {
      visitorId =
        window.crypto.randomUUID();
    } else {
      visitorId =
        `v-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    }

    localStorage.setItem(
      ACCESS_VISITOR_KEY,
      visitorId
    );

    return visitorId;

  } catch {

    // localStorageが使えない場合でもサイト本体は止めない
    return `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  }

}


async function recordSiteAccess() {

  if (!sb) {
    return;
  }

  try {

    const visitorId =
      getOrCreateAccessVisitorId();

    const { error } =
      await sb.rpc(
        "record_site_visit",
        {
          p_visitor_id:
            visitorId
        }
      );

    if (error) {
      console.debug(
        "アクセス記録をスキップしました。",
        error.message || error
      );
    }

  } catch (error) {

    // 解析失敗で本体機能を止めない
    console.debug(
      "アクセス記録エラー",
      error
    );

  }

}


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

// PASS再編集・再延長
let loadedManagedRecruitment = null;
let loadedManagePass = "";
let loadedManagePassHash = "";
let manageEditPreparedFile = null;
let manageEditObjectUrl = null;



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
// BlablaLink 自動キャプチャ
// 対応URL：/post/detail?...&post_uuid=...
// ========================================

function isBlablaLinkPostUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, "");

    if (
      host !== "blablalink.com" &&
      !host.endsWith(".blablalink.com")
    ) {
      return false;
    }

    return (
      url.pathname === "/post/detail" &&
      Boolean(url.searchParams.get("post_uuid"))
    );
  } catch {
    return false;
  }
}

async function fetchBlablaLinkPreviewFile(value) {
  if (!isBlablaLinkPostUrl(value)) {
    throw new Error("INVALID_BLABLALINK_POST_URL");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35000);

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/blablalink-preview`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          url: String(value || "").trim()
        }),
        signal: controller.signal
      }
    );

    if (!response.ok) {
      let message = `BLABLALINK_PREVIEW_HTTP_${response.status}`;
      try {
        const data = await response.json();
        message = data?.error || data?.message || message;
      } catch {}
      throw new Error(message);
    }

    const contentType = response.headers.get("content-type") || "image/png";
    if (!contentType.startsWith("image/")) {
      throw new Error("BLABLALINK_PREVIEW_NOT_IMAGE");
    }

    const blob = await response.blob();
    if (!blob.size) {
      throw new Error("BLABLALINK_PREVIEW_EMPTY");
    }

    const cleanType = contentType.split(";")[0];
    const extension =
      cleanType.includes("webp")
        ? "webp"
        : cleanType.includes("jpeg")
          ? "jpg"
          : "png";

    return new File(
      [blob],
      `blablalink-preview-${Date.now()}.${extension}`,
      { type: cleanType, lastModified: Date.now() }
    );
  } finally {
    clearTimeout(timer);
  }
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
  xEmbedEnabled = true,
  forcePreviewImage = false
) {

  const platform =
    getRecruitmentPlatform(url);

  // ========================================
  // v13.17 画像優先表示
  // 登録画像がある場合は、掲載先やX埋め込み設定に関係なく
  // 必ず登録画像を最優先で表示する。
  // BlablaLinkの自動キャプチャは画像未選択時だけ取得されるため、
  // 手動画像を登録した場合はその画像がそのまま優先される。
  // forcePreviewImage は旧データ互換のため引数として残す。
  // ========================================
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
          alt="${escapeHtml(platform)}募集記事の登録画像"
          loading="lazy"
        >
      </a>
    `;
  }

  // 登録画像が無いXだけ、X埋め込みを表示する。
  if (platform === "X") {

    const postId =
      getXPostId(url);

    if (xEmbedEnabled !== false) {
      return `
        <div
          class="x-embed"
          data-post-id="${escapeHtml(postId || "")}"
          data-preview-image-url=""
          data-recruitment-url="${escapeHtml(url || "")}"
        ></div>
      `;
    }

    return `
      <div class="x-embed-error">
        <strong>🙈 X埋め込み表示はOFFです</strong><br>
        <span>下のボタンから募集記事を確認できます。</span>
      </div>
    `;
  }

  // BlablaLink / Discord / その他で画像が無い場合。
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



// ========================================
// 募集画像アップロード
// ========================================

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

  const previewImageUrl =
    target.dataset.previewImageUrl || "";

  const recruitmentUrl =
    target.dataset.recruitmentUrl || "";

  // 管理画面などから登録された画像がある場合は、
  // X埋め込みが削除済み / Not found / 読み込み失敗でも画像を表示する。
  if (previewImageUrl) {

    target.innerHTML = `
      <div class="registration-preview-platform">
        掲載先：X
      </div>
      <a
        class="recruitment-preview-link"
        href="${escapeHtml(recruitmentUrl)}"
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

    return;
  }

  target.innerHTML =
    '<div class="x-embed-error">' +
      '<strong>X投稿を埋め込み表示できません</strong><br>' +
      '<span>下の「Xで募集記事を開く」から確認してください。</span>' +
    '</div>';

}


// X側は削除済み投稿でも iframe 自体を返して
// 「Not found」と表示する場合があるため、Promise成功だけでは判定できない。
// 登録画像がある募集だけ、描画後のiframe高さを見て小さすぎる場合は画像へフォールバックする。
function checkXEmbedUnavailable(target) {

  if (!target) {
    return;
  }

  const previewImageUrl =
    target.dataset.previewImageUrl || "";

  if (!previewImageUrl) {
    return;
  }

  if (target.dataset.loaded !== "true") {
    return;
  }

  const iframe =
    target.querySelector("iframe");

  if (!iframe) {
    showXEmbedFallback(target);
    return;
  }

  const iframeRect =
    iframe.getBoundingClientRect();

  const iframeHeight =
    Math.max(
      iframeRect.height || 0,
      iframe.offsetHeight || 0,
      Number(iframe.getAttribute("height")) || 0
    );

  const targetHeight =
    Math.max(
      target.getBoundingClientRect().height || 0,
      target.offsetHeight || 0
    );

  // Xは削除済み投稿でも「Not found」用iframeを返すことがある。
  // そのiframeは通常の投稿よりかなり低い。
  // 管理画面で画像が登録済みなら、小さい埋め込みを画像へ切り替える。
  const renderedHeight =
    Math.max(iframeHeight, targetHeight);

  if (renderedHeight <= 260) {
    showXEmbedFallback(target);
  }

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

          // Xが「Not found」のiframeを返すケースを判定。
          // iframeの描画完了を待ってから確認する。
          // Xのiframeは段階的に高さが確定するため複数回確認する。
          [1200, 3000, 6000].forEach(delay => {
            setTimeout(
              () => checkXEmbedUnavailable(target),
              delay
            );
          });

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

    /*
      v40 tablet only:
      footer buttons and top drawer use exactly the same immediate list move.
      Smartphone and PC keep their previous behavior.
    */
    if (
      document.documentElement
        .classList
        .contains(
          "tablet-device"
        )
    ) {

      const tabletListPage =
        document.getElementById(
          "listPage"
        );

      if (!tabletListPage) {
        return;
      }

      mobileFooterHideUntilTop =
        false;

      scrollAppElementToTop(
        tabletListPage,
        "auto"
      );

      document
        .getElementById(
          "bottomNav"
        )
        ?.classList
        .add(
          "is-visible"
        );

      return;
    }

    setTimeout(() => {

      const listPage =
        document.getElementById("listPage");

      if (!listPage) {
        return;
      }

      const mobileShell =
        getMobileScrollShell();

      if (mobileShell) {

        scrollAppElementToTop(
          listPage,
          "smooth"
        );

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

    scrollAppToTop(
      "smooth"
    );

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
// TOP表示用：現在利用中ユニオン数
// TOTAL UNIONS = 現在の会員台帳だけを数える。
// 過去の募集履歴・終了済み募集は集計しない。
// ========================================

async function loadTotalRegisteredUnionCount() {

  const counter =
    $("#totalUnionCountTop");

  if (!counter) {
    return 0;
  }

  if (!sb) {
    counter.textContent = "0";
    return 0;
  }

  const {
    data,
    error
  } =
    await sb.rpc(
      "get_active_union_member_count"
    );

  if (error) {

    console.error(
      "現在利用中ユニオン数取得エラー",
      error
    );

    const fallback =
      Number(
        $("#unionCountTop")
          ?.textContent
        ||
        $("#unionCount")
          ?.textContent
        ||
        0
      );

    counter.textContent =
      String(fallback);

    return fallback;
  }

  const total =
    Number(
      Array.isArray(data)
        ? data[0]
        : data
    );

  const safeTotal =
    Number.isFinite(total)
      ? total
      : 0;

  counter.textContent =
    String(safeTotal);

  return safeTotal;
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


  // カウンターは一覧表示を待たせずバックグラウンド更新
  void Promise.allSettled([
    loadGraduatedCommanderCount(),
    loadTotalRegisteredUnionCount()
  ]);


  // ======================================
  // 指揮官取得
  // ======================================

  const commanderQuery =

    sb
      .from(
        "recruitments"
      )
      .select(
        "id, commander_name, slv, x_url, x_embed_enabled, preview_image_url, force_preview_image, created_at, expires_at"
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
        "id, union_name, union_rank, x_url, x_embed_enabled, preview_image_url, force_preview_image, created_at, expires_at"
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
                    item.x_embed_enabled,
                    item.force_preview_image === true
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
                    item.x_embed_enabled,
                    item.force_preview_image === true
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


const unionRecruitModeBtn =
  $("#unionRecruitModeBtn");


const unionRegisterOnlyModeBtn =
  $("#unionRegisterOnlyModeBtn");


const unionUsageNote =
  $("#unionUsageNote");


const recruitmentInputFields =
  $("#recruitmentInputFields");


let unionRegistrationMode =
  "recruit";


function setUnionRegistrationMode(mode) {

  unionRegistrationMode =
    mode === "register-only"
      ? "register-only"
      : "recruit";

  const registerOnly =
    unionRegistrationMode === "register-only";

  unionRecruitModeBtn
    ?.classList
    .toggle("active", !registerOnly);

  unionRegisterOnlyModeBtn
    ?.classList
    .toggle("active", registerOnly);

  unionRecruitModeBtn
    ?.setAttribute("aria-pressed", String(!registerOnly));

  unionRegisterOnlyModeBtn
    ?.setAttribute("aria-pressed", String(registerOnly));

  if (unionUsageNote) {
    unionUsageNote.textContent =
      registerOnly
        ? "登録のみ行い、求人広告は掲載しません。"
        : "求人広告を掲載します。";
  }

  updateRegistrationFields();
}


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


  const registerOnly =
    isUnion
    &&
    unionRegistrationMode === "register-only";


  recruitmentInputFields
    ?.classList
    .toggle("hidden", registerOnly);


  const xUrl =
    $("#xUrl");

  if (xUrl) {
    xUrl.required =
      !registerOnly;
  }

}


unionRecruitModeBtn
  ?.addEventListener(
    "click",
    () => setUnionRegistrationMode("recruit")
  );


unionRegisterOnlyModeBtn
  ?.addEventListener(
    "click",
    () => setUnionRegistrationMode("register-only")
  );


registrationTypeSelect
  ?.addEventListener(
    "change",
    updateRegistrationFields
  );


updateRegistrationFields();


// ========================================
// 登録前プレビュー
// ========================================

function clearInitialPreviewImageSelection(showMessage = true) {

  const input =
    $("#previewImage");

  if (input) {
    input.value = "";
  }

  registrationPreviewApproved = false;
  registrationPreviewPreparedFile = null;

  if (registrationPreviewObjectUrl) {
    URL.revokeObjectURL(registrationPreviewObjectUrl);
    registrationPreviewObjectUrl = null;
  }

  $("#previewImageClearBtn")
    ?.classList
    .add("hidden");

  const status =
    $("#previewImageStatus");

  if (status) {
    const url =
      $("#xUrl")?.value.trim() || "";

    if (isBlablaLinkPostUrl(url)) {
      status.textContent =
        "選択画像を取り消しました。確認画面ではBlablaLinkの自動プレビューを取得します。";
    } else {
      status.textContent =
        showMessage
          ? "選択画像を取り消しました。画像なしでも登録できます。"
          : "";
    }
  }
}


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

  const registerOnly =
    registrationType === "union"
    &&
    unionRegistrationMode === "register-only";

  const xUrl =
    registerOnly
      ? ""
      : $("#xUrl")?.value.trim() || "";

  if (!registerOnly && !validRecruitmentUrl(xUrl)) {
    alert("募集記事URLを入力してください。\nX・BlablaLink・DiscordなどのURLに対応しています。");
    return false;
  }

  const previewFile =
    registerOnly
      ? null
      : $("#previewImage")?.files?.[0] || null;

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

  const platform =
    getRecruitmentPlatform(xUrl);

  const previewButton = $("#registerPreviewBtn");
  const originalButtonText =
    previewButton?.textContent || "登録内容を確認する";
  const status = $("#previewImageStatus");

  // 手動画像がある場合は手動画像を優先。
  if (previewFile) {
    if (previewButton) {
      previewButton.disabled = true;
      previewButton.textContent = "画像を自動最適化中...";
    }

    try {
      registrationPreviewPreparedFile =
        await optimizePreviewImageFile(previewFile);

      registrationPreviewObjectUrl =
        URL.createObjectURL(registrationPreviewPreparedFile);

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

  // BlablaLink投稿で画像未選択なら、自動キャプチャを試す。
  if (
    !previewFile &&
    platform === "BlablaLink" &&
    isBlablaLinkPostUrl(xUrl)
  ) {
    if (previewButton) {
      previewButton.disabled = true;
      previewButton.textContent = "BlablaLinkプレビュー取得中...";
    }

    if (status) {
      status.textContent = "BlablaLinkの記事を自動取得しています...";
    }

    try {
      const autoPreviewFile =
        await fetchBlablaLinkPreviewFile(xUrl);

      registrationPreviewPreparedFile =
        await optimizePreviewImageFile(autoPreviewFile);

      registrationPreviewObjectUrl =
        URL.createObjectURL(registrationPreviewPreparedFile);

      if (status) {
        status.textContent =
          `BlablaLinkから自動取得しました（${formatFileSize(registrationPreviewPreparedFile.size)}）`;
      }
    } catch (error) {
      console.warn("BlablaLink自動プレビュー取得失敗", error);
      registrationPreviewPreparedFile = null;

      if (registrationPreviewObjectUrl) {
        URL.revokeObjectURL(registrationPreviewObjectUrl);
        registrationPreviewObjectUrl = null;
      }

      // 取得失敗でも登録は止めない。
      if (status) {
        status.textContent =
          "BlablaLinkの自動取得に失敗しました。画像なしでも登録できます。必要なら画像を選択してください。";
      }
    } finally {
      if (previewButton) {
        previewButton.disabled = false;
        previewButton.textContent = originalButtonText;
      }
    }
  }

  if (registerOnly) {
    const host =
      $("#registrationPreviewCard");

    if (!host) {
      return false;
    }

    host.innerHTML = `
      <article class="card union-card">
        <div class="card-head">
          <div class="type-with-new">
            <span class="recruitment-type">● ユニオン</span>
          </div>
          <span class="date">管理期限 14日後</span>
        </div>

        <div class="name">${escapeHtml(name)}</div>
        <div class="union-rank rank-${escapeHtml(getUnionRankClass(detail))}">${escapeHtml(detail)}</div>
        <div class="countdown">残り14日</div>

        <div class="notice" style="margin-top:14px;">
          <strong>登録のみ</strong><br>
          求人広告は掲載されません。
        </div>
      </article>
    `;

    $("#registrationPreviewModal")
      ?.classList
      .remove("hidden");

    return true;
  }


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


$("#xUrl")
  ?.addEventListener(
    "input",
    () => {
      registrationPreviewApproved = false;
      registrationPreviewPreparedFile = null;

      if (registrationPreviewObjectUrl) {
        URL.revokeObjectURL(registrationPreviewObjectUrl);
        registrationPreviewObjectUrl = null;
      }

      const status = $("#previewImageStatus");
      const selectedFile = $("#previewImage")?.files?.[0] || null;

      if (status && !selectedFile) {
        const url = $("#xUrl")?.value.trim() || "";
        status.textContent =
          isBlablaLinkPostUrl(url)
            ? "BlablaLink投稿は確認画面で自動プレビューを取得します。画像は任意です。"
            : "";
      }
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
        $("#previewImageClearBtn")
          ?.classList
          .add("hidden");

        if (status) {
          status.textContent = "";
        }
        return;
      }

      if (!validatePreviewImageFile(file)) {
        event.target.value = "";

        $("#previewImageClearBtn")
          ?.classList
          .add("hidden");

        if (status) {
          status.textContent = "";
        }
        return;
      }

      $("#previewImageClearBtn")
        ?.classList
        .remove("hidden");

      if (status) {
        status.textContent =
          `選択画像：${formatFileSize(file.size)} / 20MBまで（確認時に自動最適化）`;
      }
    }
  );


$("#previewImageClearBtn")
  ?.addEventListener(
    "click",
    () => {
      clearInitialPreviewImageSelection(true);
    }
  );


// ========================================
// 登録結果表示
// ========================================

function showRegistrationResult(
  pass,
  result,
  registerOnly = false,
  isUnion = false
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


  const resultModeNote =
    $("#registrationResultModeNote");

  const resultExpiryLabel =
    $("#resultExpiryLabel");

  const registrationShareChoice =
    $("#registrationShareChoice");

  const registrationPassWarningTitle =
    $("#registrationPassWarningTitle");

  const registrationPassWarningText =
    $("#registrationPassWarningText");

  if (registrationPassWarningTitle) {
    registrationPassWarningTitle.textContent =
      "PASSを必ず保存してください。";
  }

  if (registrationPassWarningText) {
    registrationPassWarningText.textContent =
      isUnion
        ? "利用確認・募集の編集／締切・BOT連携・UNION MATCHの会員登録解除に必要です。"
        : "次回の編集・再延長・締切に必要です。";
  }

  if (resultModeNote) {
    resultModeNote.textContent =
      registerOnly
        ? "登録のみで保存しました。求人広告は掲載されません。"
        : "";

    resultModeNote.classList.toggle(
      "hidden",
      !registerOnly
    );
  }

  if (resultExpiryLabel) {
    resultExpiryLabel.textContent =
      registerOnly
        ? "管理期限"
        : "掲載期限";
  }

  registrationShareChoice
    ?.classList
    .toggle("hidden", registerOnly);


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


      const registerOnly =
        registrationType === "union"
        &&
        unionRegistrationMode === "register-only";


      const xUrl =

        registerOnly
          ? ""
          : $("#xUrl")
              ?.value
              .trim();


      const originalPreviewFile =
        registerOnly
          ? null
          : $("#previewImage")
              ?.files?.[0]
            ||
            null;

      const previewFile =
        registrationPreviewPreparedFile || originalPreviewFile;


      if (!validatePreviewImageFile(originalPreviewFile)) {
        return;
      }


      if (
        !registerOnly
        &&
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


          const unionRpcName =
            registerOnly
              ? "create_union_registration_only"
              : "create_union_member_recruitment_url";

          const unionRpcParams =
            registerOnly
              ? {
                  p_union_name:
                    unionName,

                  p_union_rank:
                    unionRank,

                  p_pass_hash:
                    passHash
                }
              : {
                  p_union_name:
                    unionName,

                  p_union_rank:
                    unionRank,

                  p_x_url:
                    xUrl,

                  p_pass_hash:
                    passHash
                };

          const {
            data,
            error
          } =

            await sb.rpc(
              unionRpcName,
              unionRpcParams
            );


          if (error) {


            const errorText =
              getErrorText(
                error
              );


            if (
              registerOnly
              &&
              (
                errorText.includes(
                  "create_union_registration_only"
                )
                ||
                errorText.includes(
                  "PGRST202"
                )
                ||
                errorText.includes(
                  "Could not find the function"
                )
              )
            ) {

              alert(
                "「登録のみ」用のSupabase SQLがまだ反映されていません。\n付属の supabase_union_membership_v51.sql をSQL EditorでRunしてください。"
              );

              return;

            }


            if (
              errorText.includes(
                "UNION_ALREADY_REGISTERED"
              )
              ||
              errorText.includes(
                "UNION_NAME_DUPLICATE"
              )
            ) {

              alert(
                "このユニオンは現在登録中です。\n既存のPASSから「利用確認・編集」で募集の開始／停止を切り替えてください。"
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


          if (!registerOnly && previewFile && result?.id) {
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

          lastRegisteredRecruitment =
            registerOnly
              ? null
              : {

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
            result,
            registerOnly,
            true
          );

          // 登録完了後は、PASSモーダルを表示したまま
          // 背景をTOPページへ戻す。
          await loadRecruitments();
          returnToVideoTop();


          event.target.reset();
          clearInitialPreviewImageSelection(false);

          setUnionRegistrationMode("recruit");
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

        // 登録完了後は、PASSモーダルを表示したまま
        // 背景をTOPページへ戻す。
        await loadRecruitments();
        returnToVideoTop();


        event.target.reset();
        clearInitialPreviewImageSelection(false);


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
// PASSで募集を再編集・再延長・締切
// ========================================

function resetManageImageState() {

  manageEditPreparedFile = null;

  if (manageEditObjectUrl) {
    URL.revokeObjectURL(manageEditObjectUrl);
    manageEditObjectUrl = null;
  }

  const fileInput =
    $("#manageEditImage");

  if (fileInput) {
    fileInput.value = "";
  }

  const status =
    $("#manageEditImageStatus");

  if (status) {
    status.textContent =
      "未選択なら現在の画像をそのまま使用します。20MBまで。選択画像は自動で最適化されます。";
  }

  $("#manageEditSelectedImageBox")
    ?.classList
    .add("hidden");

  const selectedPreview =
    $("#manageEditSelectedImage");

  if (selectedPreview) {
    selectedPreview.removeAttribute("src");
  }

  const removeCheckbox =
    $("#manageRemoveImage");

  if (removeCheckbox) {
    removeCheckbox.checked = false;
  }
}


function resetManageActionMenu() {

  $("#managePrimaryActions")
    ?.classList
    .remove("hidden");

  $("#manageEditActionChoices")
    ?.classList
    .add("hidden");
}


function showManageEditActionChoices() {

  if (!loadedManagedRecruitment) {
    alert("先にPASSから募集内容を呼び出してください。");
    return;
  }

  $("#managePrimaryActions")
    ?.classList
    .add("hidden");

  $("#manageEditActionChoices")
    ?.classList
    .remove("hidden");
}


function clearLoadedManageRecruitment() {

  loadedManagedRecruitment = null;
  loadedManagePass = "";
  loadedManagePassHash = "";

  resetManageImageState();
  resetManageActionMenu();

  $("#managePage")
    ?.classList
    .remove("manage-loaded-mode");

  $("#manageLoadedPanel")
    ?.classList
    .add("hidden");

  $("#manageEditPanel")
    ?.classList
    .add("hidden");
}


function getManagedRecruitmentStatus(item) {

  if (!item) {
    return "--";
  }

  if (item.type === "union") {

    const recruitmentExpiry =
      new Date(item.expires_at).getTime();

    if (
      item.status === "open"
      &&
      item.recruitment_id
      &&
      Number.isFinite(recruitmentExpiry)
      &&
      recruitmentExpiry > Date.now()
    ) {
      return "募集中";
    }

    return "登録のみ";
  }

  const expiresTime =
    new Date(item.expires_at).getTime();

  if (item.status !== "open") {
    return "締切済み";
  }

  if (
    Number.isFinite(expiresTime)
    &&
    expiresTime <= Date.now()
  ) {
    return "期限切れ";
  }

  return "募集中";
}


function renderLoadedManageRecruitment() {

  const item =
    loadedManagedRecruitment;

  if (!item) {
    $("#manageLoadedPanel")
      ?.classList
      .add("hidden");

    $("#managePage")
      ?.classList
      .remove("manage-loaded-mode");
    return;
  }

  const isUnion =
    item.type === "union";

  const isUnionRecruiting =
    isUnion
    &&
    getManagedRecruitmentStatus(item) === "募集中";

  const name =
    String(item.name || "");

  const detail =
    isUnion
      ? String(item.union_rank || "")
      : `SLV ${Number(item.slv || 0)}`;

  if ($("#manageLoadedEyebrow")) {
    $("#manageLoadedEyebrow").textContent =
      isUnion
        ? "UNION MEMBERSHIP"
        : "CURRENT RECRUITMENT";
  }

  if ($("#manageCurrentName")) {
    $("#manageCurrentName").textContent =
      `${isUnion ? "🏢" : "👤"} ${name}`;
  }

  if ($("#manageCurrentDetail")) {
    $("#manageCurrentDetail").textContent = detail;
  }

  if ($("#manageCurrentExpiryLabel")) {
    $("#manageCurrentExpiryLabel").textContent =
      isUnion
        ? (
            isUnionRecruiting
              ? "募集掲載期限"
              : "次回利用確認期限"
          )
        : "現在の期限";
  }

  if ($("#manageCurrentExpiry")) {
    $("#manageCurrentExpiry").textContent =
      item.expires_at
        ? formatDate(item.expires_at)
        : "--";
  }

  if ($("#manageCurrentStatus")) {
    $("#manageCurrentStatus").textContent =
      getManagedRecruitmentStatus(item);
  }

  const membershipNotice =
    $("#manageMembershipConfirmedNotice");

  if (membershipNotice) {
    if (isUnion) {
      const nextDate =
        item.member_expires_at
          ? formatDate(item.member_expires_at)
          : "14日後";

      membershipNotice.innerHTML =
        `<span class="manage-confirm-check" aria-hidden="true">✅</span>`
        + `<span>利用確認が完了しました。次回確認期限：${nextDate}</span>`;
      membershipNotice.classList.remove("hidden");
    } else {
      membershipNotice.classList.add("hidden");
      membershipNotice.textContent = "";
    }
  }

  const memberExpiryBox =
    $("#manageMembershipExpiryBox");

  if (memberExpiryBox) {
    memberExpiryBox.classList.toggle(
      "hidden",
      !isUnion || !isUnionRecruiting
    );
  }

  if ($("#manageMembershipExpiry")) {
    $("#manageMembershipExpiry").textContent =
      item.member_expires_at
        ? formatDate(item.member_expires_at)
        : "--";
  }

  const urlWrap =
    $("#manageCurrentUrl")
      ?.closest(".manage-current-url");

  const urlLink =
    $("#manageCurrentUrl");

  if (urlWrap) {
    urlWrap.classList.toggle(
      "hidden",
      isUnion && !isUnionRecruiting
    );
  }

  if (urlLink) {
    urlLink.textContent = item.x_url || "--";

    if (item.x_url) {
      urlLink.href = item.x_url;
    } else {
      urlLink.removeAttribute("href");
    }
  }

  const imageBox =
    $("#manageCurrentImageBox");

  const image =
    $("#manageCurrentImage");

  if (isUnionRecruiting || !isUnion) {
    if (
      item.preview_image_url
      && imageBox
      && image
    ) {
      image.src = item.preview_image_url;
      imageBox.classList.remove("hidden");
    } else {
      imageBox?.classList.add("hidden");
      image?.removeAttribute("src");
    }
  } else {
    imageBox?.classList.add("hidden");
    image?.removeAttribute("src");
  }

  const editButton =
    $("#openManageActionBtn");

  if (editButton) {
    editButton.textContent =
      isUnion && !isUnionRecruiting
        ? "募集を開始"
        : "✏️ 編集";
    editButton.classList.toggle("hidden", !isUnion);
  }

  const closeButton =
    $("#closeLoadedRecruitmentBtn");

  if (closeButton) {
    closeButton.textContent =
      isUnion ? "求人広告を締め切る" : "募集を締め切る";
    closeButton.classList.toggle(
      "hidden",
      isUnion && !isUnionRecruiting
    );
  }

  const deleteMembershipButton =
    $("#deleteUnionMembershipBtn");

  if (deleteMembershipButton) {
    deleteMembershipButton.textContent =
      "UNION MATCHから登録を削除";
    deleteMembershipButton.classList.toggle(
      "hidden",
      !isUnion
    );
  }

  // 手動の14日更新は表示しない。
  // ユニオンPASSを呼び出した時点で既存RPCが14日利用確認を行う。
  $("#renewUnchangedBtn")
    ?.classList
    .add("hidden");

  $("#manageEditActionChoices")
    ?.classList
    .add("hidden");

  $("#managePrimaryActions")
    ?.classList
    .remove("hidden");

  $("#managePage")
    ?.classList
    .add("manage-loaded-mode");

  $("#manageLoadedPanel")
    ?.classList
    .remove("hidden");
}


function populateManageEditForm() {

  const item =
    loadedManagedRecruitment;

  if (!item) {
    return;
  }

  resetManageImageState();

  const isUnion =
    item.type === "union";

  const isUnionRecruiting =
    isUnion
    &&
    getManagedRecruitmentStatus(item) === "募集中";

  if ($("#manageEditTitle")) {
    $("#manageEditTitle").textContent =
      isUnion && !isUnionRecruiting
        ? "求人広告を掲載"
        : "募集内容を編集";
  }

  if ($("#manageEditNameLabel")) {
    $("#manageEditNameLabel").textContent =
      isUnion
        ? "ユニオン名"
        : "指揮官名";
  }

  if ($("#manageEditName")) {
    $("#manageEditName").textContent =
      item.name || "--";
  }

  $("#manageCommanderEditFields")
    ?.classList
    .toggle("hidden", isUnion);

  $("#manageUnionEditFields")
    ?.classList
    .toggle("hidden", !isUnion);

  if (!isUnion && $("#manageEditSlv")) {
    $("#manageEditSlv").value =
      String(item.slv || "");
  }

  if (isUnion && $("#manageEditUnionRank")) {
    $("#manageEditUnionRank").value =
      item.union_rank || "プラチナ";
  }

  if ($("#manageEditUrl")) {
    $("#manageEditUrl").value =
      item.x_url || "";
  }

  $("#manageEditPanel")
    ?.classList
    .remove("hidden");

  setTimeout(() => {
    $("#manageEditPanel")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
  }, 50);
}


function normalizeManagePass() {

  return (
    $("#closePass")
      ?.value
      .trim()
      .toUpperCase()
    ||
    ""
  );
}


async function loadRecruitmentForManage() {

  if (!sb) {
    alert("Supabaseの設定がまだです。");
    return;
  }

  const pass =
    normalizeManagePass();

  if (pass.length !== 8) {
    alert("登録時に発行された8文字PASSを入力してください。");
    return;
  }

  const passHash =
    await sha256(pass);

  const button =
    $("#loadManageRecruitmentBtn");

  const originalText =
    button?.textContent || "🔑 登録内容を呼び出す";

  if (button) {
    button.disabled = true;
    button.textContent = "登録内容を確認中...";
  }

  try {

    // --------------------------------------
    // まずユニオン会員PASSを確認。
    // 正しいPASSなら、この呼び出し自体が14日利用確認になる。
    // --------------------------------------
    const membershipResult =
      await sb.rpc(
        "confirm_union_membership_by_pass",
        {
          p_pass_hash:
            passHash
        }
      );

    if (membershipResult.error) {

      const membershipErrorText =
        getErrorText(
          membershipResult.error
        );

      if (
        membershipErrorText.includes(
          "confirm_union_membership_by_pass"
        )
        ||
        membershipErrorText.includes(
          "PGRST202"
        )
        ||
        membershipErrorText.includes(
          "Could not find the function"
        )
      ) {
        alert(
          "ユニオン会員管理SQLがまだ反映されていません。\n付属の supabase_union_membership_v51.sql を先にRunしてください。"
        );
        return;
      }

      console.error(
        "ユニオン会員PASS確認エラー",
        membershipResult.error
      );
    }

    const membershipData =
      Array.isArray(
        membershipResult.data
      )
        ? membershipResult.data[0]
        : membershipResult.data;

    if (membershipData) {

      loadedManagedRecruitment =
        membershipData;

      loadedManagePass =
        pass;

      loadedManagePassHash =
        passHash;

      $("#manageEditPanel")
        ?.classList
        .add("hidden");

      resetManageImageState();
      resetManageActionMenu();
      renderLoadedManageRecruitment();

      await loadTotalRegisteredUnionCount();

      setTimeout(() => {
        $("#manageLoadedPanel")
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
      }, 50);

      return;
    }


    // --------------------------------------
    // ユニオン会員でなければ、従来の指揮官募集PASSを確認。
    // 指揮官側の既存仕様は変更しない。
    // --------------------------------------
    const {
      data,
      error
    } =
      await sb.rpc(
        "get_recruitment_by_pass_for_reregister",
        {
          p_pass_hash:
            passHash
        }
      );

    if (error) {
      console.error(
        "PASS募集取得エラー",
        error
      );

      const errorText =
        getErrorText(error);

      if (
        errorText.includes(
          "Could not find the function"
        )
        ||
        errorText.includes(
          "PGRST202"
        )
      ) {
        alert(
          "PASS再編集機能のSQLがまだ反映されていません。"
        );
        return;
      }

      alert(
        "登録内容を読み込めませんでした。"
      );
      return;
    }

    const fallbackData =
      Array.isArray(data)
        ? data[0]
        : data;

    if (!fallbackData) {
      clearLoadedManageRecruitment();
      alert(
        "PASSが正しくないか、ユニオン会員の利用確認期限が切れています。\n期限切れのユニオンは会員解除済みのため、再利用する場合は新規登録してください。"
      );
      return;
    }

    // 新ルールではユニオンは必ず会員台帳経由。
    // 旧募集PASSだけが残っているユニオンを復活させない。
    if (
      String(
        fallbackData.type || ""
      ) === "union"
    ) {
      clearLoadedManageRecruitment();
      alert(
        "このユニオンは現在の会員台帳にありません。\n再利用する場合はユニオンを新規登録してください。"
      );
      return;
    }

    loadedManagedRecruitment =
      fallbackData;

    loadedManagePass =
      pass;

    loadedManagePassHash =
      passHash;

    $("#manageEditPanel")
      ?.classList
      .add("hidden");

    resetManageImageState();
    resetManageActionMenu();
    renderLoadedManageRecruitment();

    setTimeout(() => {
      $("#manageLoadedPanel")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
    }, 50);

  } finally {

    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}


$("#closeForm")
  ?.addEventListener(
    "submit",
    async event => {
      event.preventDefault();
      await loadRecruitmentForManage();
    }
  );


$("#closePass")
  ?.addEventListener(
    "input",
    event => {

      const normalized =
        String(event.target?.value || "")
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
          .slice(0, 8);

      if (event.target) {
        event.target.value = normalized;
      }

      if (
        loadedManagePass
        &&
        normalized !== loadedManagePass
      ) {
        clearLoadedManageRecruitment();
      }
    }
  );


$("#openManageActionBtn")
  ?.addEventListener(
    "click",
    () => {
      if (
        !loadedManagedRecruitment
        || loadedManagedRecruitment.type !== "union"
      ) {
        return;
      }

      populateManageEditForm();
    }
  );


$("#backManageActionBtn")
  ?.addEventListener(
    "click",
    () => {
      resetManageImageState();

      $("#manageEditPanel")
        ?.classList
        .add("hidden");

      resetManageActionMenu();

      $("#manageLoadedPanel")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
    }
  );


$("#openManageEditBtn")
  ?.addEventListener(
    "click",
    () => {
      if (!loadedManagedRecruitment) {
        alert("先にPASSから募集内容を呼び出してください。");
        return;
      }

      populateManageEditForm();
    }
  );


$("#cancelManageEditBtn")
  ?.addEventListener(
    "click",
    () => {
      resetManageImageState();

      $("#manageEditPanel")
        ?.classList
        .add("hidden");

      $("#manageEditActionChoices")
        ?.classList
        .add("hidden");

      $("#managePrimaryActions")
        ?.classList
        .remove("hidden");

      $("#manageLoadedPanel")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
    }
  );


$("#manageEditImage")
  ?.addEventListener(
    "change",
    event => {

      manageEditPreparedFile = null;

      if (manageEditObjectUrl) {
        URL.revokeObjectURL(manageEditObjectUrl);
        manageEditObjectUrl = null;
      }

      const file =
        event.target?.files?.[0] || null;

      const status =
        $("#manageEditImageStatus");

      if (!file) {
        $("#manageEditSelectedImageBox")
          ?.classList
          .add("hidden");

        if (status) {
          status.textContent =
            "未選択なら現在の画像をそのまま使用します。20MBまで。選択画像は自動で最適化されます。";
        }
        return;
      }

      if (!validatePreviewImageFile(file)) {
        event.target.value = "";
        $("#manageEditSelectedImageBox")
          ?.classList
          .add("hidden");
        return;
      }

      const remove =
        $("#manageRemoveImage");

      if (remove) {
        remove.checked = false;
      }

      manageEditObjectUrl =
        URL.createObjectURL(file);

      const preview =
        $("#manageEditSelectedImage");

      if (preview) {
        preview.src = manageEditObjectUrl;
      }

      $("#manageEditSelectedImageBox")
        ?.classList
        .remove("hidden");

      if (status) {
        status.textContent =
          `選択画像：${formatFileSize(file.size)} / 20MBまで（確認時に自動最適化）`;
      }
    }
  );


$("#manageRemoveImage")
  ?.addEventListener(
    "change",
    event => {

      if (!event.target?.checked) {
        return;
      }

      manageEditPreparedFile = null;

      if (manageEditObjectUrl) {
        URL.revokeObjectURL(manageEditObjectUrl);
        manageEditObjectUrl = null;
      }

      const fileInput =
        $("#manageEditImage");

      if (fileInput) {
        fileInput.value = "";
      }

      $("#manageEditSelectedImageBox")
        ?.classList
        .add("hidden");

      const status =
        $("#manageEditImageStatus");

      if (status) {
        status.textContent =
          "現在の登録画像を削除して再登録します。";
      }
    }
  );


async function prepareManageEditImage() {

  const inputFile =
    $("#manageEditImage")
      ?.files?.[0]
    ||
    null;

  if (!inputFile) {
    manageEditPreparedFile = null;
    return null;
  }

  if (!validatePreviewImageFile(inputFile)) {
    return null;
  }

  const button =
    $("#manageEditPreviewBtn");

  const originalText =
    button?.textContent || "再登録内容を確認する";

  if (button) {
    button.disabled = true;
    button.textContent = "画像を自動最適化中...";
  }

  try {

    manageEditPreparedFile =
      await optimizePreviewImageFile(inputFile);

    if (manageEditObjectUrl) {
      URL.revokeObjectURL(manageEditObjectUrl);
    }

    manageEditObjectUrl =
      URL.createObjectURL(manageEditPreparedFile);

    const preview =
      $("#manageEditSelectedImage");

    if (preview) {
      preview.src = manageEditObjectUrl;
    }

    $("#manageEditSelectedImageBox")
      ?.classList
      .remove("hidden");

    const status =
      $("#manageEditImageStatus");

    if (status) {
      status.textContent =
        inputFile === manageEditPreparedFile
          ? `選択画像：${formatFileSize(inputFile.size)}（そのまま使用できます）`
          : `自動最適化：${formatFileSize(inputFile.size)} → ${formatFileSize(manageEditPreparedFile.size)}`;
    }

    return manageEditPreparedFile;

  } catch (error) {

    console.error("再登録画像最適化エラー", error);
    manageEditPreparedFile = null;

    alert(
      "画像を自動最適化できませんでした。\n別のJPG / PNG / WebP画像を選択してください。"
    );

    return null;

  } finally {

    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}


function getManageEditValues() {

  const item =
    loadedManagedRecruitment;

  if (!item) {
    return null;
  }

  const url =
    $("#manageEditUrl")
      ?.value
      .trim()
    ||
    "";

  if (!validRecruitmentUrl(url)) {
    alert(
      "募集記事URLが正しくありません。\nX・BlablaLink・DiscordなどのURLを入力してください。"
    );
    return null;
  }

  if (item.type === "commander") {

    const slv =
      Number(
        $("#manageEditSlv")
          ?.value
      );

    if (
      !Number.isInteger(slv)
      ||
      slv < 1
      ||
      slv > 1200
    ) {
      alert("SLVは1～1200で入力してください。");
      return null;
    }

    return {
      type: "commander",
      slv,
      unionRank: null,
      url
    };
  }

  const unionRank =
    $("#manageEditUnionRank")
      ?.value
    ||
    "";

  if (!unionRank) {
    alert("ユニオンランクを選択してください。");
    return null;
  }

  return {
    type: "union",
    slv: null,
    unionRank,
    url
  };
}


async function showManageEditPreview() {

  const item =
    loadedManagedRecruitment;

  if (!item) {
    alert("先にPASSから募集内容を呼び出してください。");
    return;
  }

  const values =
    getManageEditValues();

  if (!values) {
    return;
  }

  const inputFile =
    $("#manageEditImage")
      ?.files?.[0]
    ||
    null;

  if (inputFile) {
    const prepared =
      await prepareManageEditImage();

    if (!prepared) {
      return;
    }
  }

  const removeImage =
    $("#manageRemoveImage")
      ?.checked === true;

  const previewImageUrl =
    manageEditPreparedFile
      ? manageEditObjectUrl
      : removeImage
        ? ""
        : item.preview_image_url || "";

  const isUnion =
    item.type === "union";

  const detailHtml =
    isUnion
      ? `<div class="union-rank rank-${escapeHtml(getUnionRankClass(values.unionRank))}">${escapeHtml(values.unionRank)}</div>`
      : `<div class="slv">${escapeHtml(values.slv)}<small class="slv-label" style="color:#7b8085 !important;-webkit-text-fill-color:#7b8085 !important;text-shadow:none !important;-webkit-text-stroke:0 !important;"> SLV</small></div>`;

  const mediaHtml =
    buildRecruitmentPreviewMedia(
      values.url,
      previewImageUrl,
      item.x_embed_enabled !== false,
      item.force_preview_image === true && Boolean(previewImageUrl)
    );

  const host =
    $("#managePreviewCard");

  if (!host) {
    return;
  }

  host.innerHTML = `
    <article class="card ${isUnion ? "union-card" : "commander-card"}">
      <div class="card-head">
        <div class="type-with-new">
          <span class="recruitment-type">${isUnion ? "● ユニオン" : "● 指揮官"}</span>
          <span class="new-badge">🔥 NEW</span>
        </div>
        <span class="date">期限 14日後</span>
      </div>

      <div class="name">${escapeHtml(item.name || "")}</div>
      ${detailHtml}
      <div class="countdown">残り14日</div>

      <div class="x-post-area">
        ${mediaHtml}

        <a
          class="x-btn"
          href="${escapeHtml(values.url)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          ${escapeHtml(getRecruitmentButtonLabel(values.url))}
        </a>
      </div>
    </article>
  `;

  $("#managePreviewModal")
    ?.classList
    .remove("hidden");

  if (isXRecruitmentUrl(values.url)) {
    setTimeout(renderXEmbeds, 0);
  }
}


$("#manageEditPreviewBtn")
  ?.addEventListener(
    "click",
    showManageEditPreview
  );


function closeManagePreview() {
  $("#managePreviewModal")
    ?.classList
    .add("hidden");
}


$("#managePreviewBack")
  ?.addEventListener(
    "click",
    closeManagePreview
  );

$("#managePreviewClose")
  ?.addEventListener(
    "click",
    closeManagePreview
  );

$("#managePreviewModal")
  ?.addEventListener(
    "click",
    event => {
      if (event.target?.id === "managePreviewModal") {
        closeManagePreview();
      }
    }
  );


function showManageResult(mode, result) {

  const isRenew =
    mode === "renew";

  const isStart =
    mode === "start";

  if ($("#manageResultTitle")) {
    $("#manageResultTitle").textContent =
      isRenew
        ? "再延長が完了しました！"
        : isStart
          ? "募集を開始しました！"
          : "再登録が完了しました！";
  }

  if ($("#manageResultSummary")) {
    $("#manageResultSummary").textContent =
      isRenew
        ? "募集内容は変更せず、掲載期限を本日から14日間に更新しました。"
        : isStart
          ? "会員登録はそのまま、求人広告を14日間の募集中へ切り替えました。"
          : "編集内容を反映し、掲載期限を本日から14日間に更新しました。";
  }

  if ($("#manageResultPass")) {
    $("#manageResultPass").textContent =
      loadedManagePass || "--------";
  }

  if ($("#manageResultExpiry")) {
    $("#manageResultExpiry").textContent =
      result?.expires_at
        ? formatDate(result.expires_at)
        : "14日後";
  }

  $("#manageResultModal")
    ?.classList
    .remove("hidden");
}


function closeManageResult() {
  $("#manageResultModal")
    ?.classList
    .add("hidden");
}


$("#manageResultClose")
  ?.addEventListener(
    "click",
    closeManageResult
  );


$("#manageCopyPass")
  ?.addEventListener(
    "click",
    async () => {

      const pass =
        $("#manageResultPass")
          ?.textContent
        ||
        "";

      try {
        await navigator.clipboard.writeText(pass);

        const button =
          $("#manageCopyPass");

        if (button) {
          button.textContent = "コピーしました";
          setTimeout(() => {
            button.textContent = "PASSをコピー";
          }, 1500);
        }
      } catch (error) {
        console.error("再登録PASSコピーエラー", error);
        alert("PASSをコピーできませんでした。手動で保存してください。");
      }
    }
  );


$("#manageResultDone")
  ?.addEventListener(
    "click",
    () => {
      closeManageResult();
      clearLoadedManageRecruitment();
      $("#closeForm")?.reset();
      showPage("list");
    }
  );


$("#renewUnchangedBtn")
  ?.addEventListener(
    "click",
    async () => {

      if (
        !loadedManagedRecruitment
        ||
        !loadedManagePassHash
      ) {
        alert("先にPASSから募集内容を呼び出してください。");
        return;
      }

      const ok =
        window.confirm(
          "募集内容は変更せず、掲載期限を本日から14日間に更新します。\n\n・一覧の一番上へ移動\n・NEW表示が復活\n・PASSは前回と同じ\n\n再延長しますか？"
        );

      if (!ok) {
        return;
      }

      const button =
        $("#renewUnchangedBtn");

      const originalText =
        button?.textContent || "🔄 内容そのままで14日再延長";

      if (button) {
        button.disabled = true;
        button.textContent = "再延長中...";
      }

      try {

        const isUnion =
          loadedManagedRecruitment.type === "union";

        const {
          data,
          error
        } =
          await sb.rpc(
            isUnion
              ? "renew_union_recruitment_by_membership_pass"
              : "renew_recruitment_by_pass",
            {
              p_pass_hash:
                loadedManagePassHash
            }
          );

        if (error) {
          console.error("再延長エラー", error);
          alert("再延長に失敗しました。PASSを確認してもう一度お試しください。");
          return;
        }

        const renewData =
          Array.isArray(data)
            ? data[0]
            : data;

        loadedManagedRecruitment = {
          ...loadedManagedRecruitment,
          ...renewData,
          status: "open",
          member_expires_at:
            renewData?.member_expires_at
            ||
            loadedManagedRecruitment.member_expires_at
        };

        renderLoadedManageRecruitment();
        showManageResult("renew", renewData);

      } finally {

        if (button) {
          button.disabled = false;
          button.textContent = originalText;
        }
      }
    }
  );


$("#managePreviewConfirm")
  ?.addEventListener(
    "click",
    async () => {

      if (
        !loadedManagedRecruitment
        ||
        !loadedManagePassHash
      ) {
        alert("PASS情報を取得できませんでした。もう一度呼び出してください。");
        return;
      }

      const values =
        getManageEditValues();

      if (!values) {
        closeManagePreview();
        return;
      }

      const inputFile =
        $("#manageEditImage")
          ?.files?.[0]
        ||
        null;

      if (
        inputFile
        &&
        !manageEditPreparedFile
      ) {
        const prepared =
          await prepareManageEditImage();

        if (!prepared) {
          return;
        }
      }

      const removeImage =
        !manageEditPreparedFile
        &&
        $("#manageRemoveImage")
          ?.checked === true;

      const button =
        $("#managePreviewConfirm");

      const originalText =
        button?.textContent || "この内容で再登録";

      if (button) {
        button.disabled = true;
        button.textContent = "再登録中...";
      }

      try {

        const isUnion =
          loadedManagedRecruitment.type === "union";

        const wasUnionRegisterOnly =
          isUnion
          &&
          getManagedRecruitmentStatus(
            loadedManagedRecruitment
          ) === "登録のみ";

        const rpcName =
          isUnion
            ? "set_union_membership_recruiting_by_pass"
            : "reregister_recruitment_by_pass";

        const rpcParams =
          isUnion
            ? {
                p_pass_hash:
                  loadedManagePassHash,
                p_union_rank:
                  values.unionRank,
                p_x_url:
                  values.url,
                p_remove_preview_image:
                  removeImage
              }
            : {
                p_pass_hash:
                  loadedManagePassHash,
                p_slv:
                  values.slv,
                p_union_rank:
                  values.unionRank,
                p_x_url:
                  values.url,
                p_remove_preview_image:
                  removeImage
              };

        const {
          data,
          error
        } =
          await sb.rpc(
            rpcName,
            rpcParams
          );

        if (error) {

          console.error("PASS再登録エラー", error);

          const errorText =
            getErrorText(error);

          if (errorText.includes("INVALID_SLV")) {
            alert("SLVは1～1200で入力してください。");
          } else if (errorText.includes("INVALID_UNION_RANK")) {
            alert("ユニオンランクが正しくありません。");
          } else if (errorText.includes("INVALID_RECRUITMENT_URL")) {
            alert("募集記事URLが正しくありません。");
          } else if (errorText.includes("PASS_NOT_FOUND")) {
            alert("PASSが正しくありません。");
          } else {
            alert("再登録に失敗しました。もう一度お試しください。");
          }

          return;
        }

        const resultData =
          Array.isArray(data)
            ? data[0]
            : data;

        let uploadedImageUrl =
          resultData?.preview_image_url
          ||
          loadedManagedRecruitment.preview_image_url
          ||
          "";

        if (
          manageEditPreparedFile
          &&
          resultData?.id
        ) {
          try {
            uploadedImageUrl =
              await uploadRecruitmentPreviewImage(
                loadedManagedRecruitment.type,
                resultData.id,
                loadedManagePassHash,
                manageEditPreparedFile
              );
          } catch (previewError) {
            console.error("再登録画像アップロードエラー", previewError);
            alert(
              "再登録は完了しましたが、画像の差し替えだけ失敗しました。\n募集自体は14日間で正常に再登録されています。"
            );
          }
        }

        loadedManagedRecruitment = {
          ...loadedManagedRecruitment,
          ...resultData,
          type: loadedManagedRecruitment.type,
          name: loadedManagedRecruitment.name,
          x_url: values.url,
          slv:
            values.type === "commander"
              ? values.slv
              : loadedManagedRecruitment.slv,
          union_rank:
            values.type === "union"
              ? values.unionRank
              : loadedManagedRecruitment.union_rank,
          preview_image_url:
            removeImage
              ? (manageEditPreparedFile ? uploadedImageUrl : "")
              : uploadedImageUrl,
          force_preview_image:
            removeImage
              ? false
              : loadedManagedRecruitment.force_preview_image,
          recruitment_id:
            isUnion
              ? resultData?.id
                || loadedManagedRecruitment.recruitment_id
              : loadedManagedRecruitment.recruitment_id,
          member_expires_at:
            resultData?.member_expires_at
            ||
            loadedManagedRecruitment.member_expires_at,
          status: "open"
        };

        closeManagePreview();
        $("#manageEditPanel")
          ?.classList
          .add("hidden");

        renderLoadedManageRecruitment();
        showManageResult(
          wasUnionRegisterOnly
            ? "start"
            : "edit",
          resultData
        );

        resetManageImageState();

      } finally {

        if (button) {
          button.disabled = false;
          button.textContent = originalText;
        }
      }
    }
  );


// ========================================
// PASSで募集締切（従来機能を維持）
// ========================================

async function closeLoadedRecruitment() {

  if (!sb) {
    alert("Supabaseの設定がまだです。");
    return;
  }

  if (
    !loadedManagedRecruitment
    ||
    !loadedManagePassHash
  ) {
    alert("先にPASSから登録内容を呼び出してください。");
    return;
  }

  // --------------------------------------
  // ユニオン
  // 募集終了 = 会員解除ではない。
  // 求人広告だけ閉じて「登録のみ」に戻す。
  // --------------------------------------
  if (
    loadedManagedRecruitment.type === "union"
  ) {

    const ok =
      window.confirm(
        "求人広告を締め切って「登録のみ」に戻しますか？\n\n会員登録は残るため、TOTAL UNIONSからは外れません。"
      );

    if (!ok) {
      return;
    }

    const {
      data,
      error
    } =
      await sb.rpc(
        "stop_union_recruiting_by_membership_pass",
        {
          p_pass_hash:
            loadedManagePassHash
        }
      );

    if (
      error
      ||
      data !== true
    ) {
      console.error(
        "ユニオン募集停止エラー",
        error || data
      );
      alert(
        "募集を締め切れませんでした。PASSを確認してもう一度お試しください。"
      );
      return;
    }

    alert(
      "求人広告を締め切りました。\nユニオン会員登録は「登録のみ」として継続します。"
    );

    clearLoadedManageRecruitment();
    $("#closeForm")?.reset();

    await loadRecruitments();
    await loadTotalRegisteredUnionCount();

    showPage("list");
    return;
  }


  // --------------------------------------
  // 指揮官
  // 従来の締切処理を維持
  // --------------------------------------
  const ok =
    window.confirm(
      "この募集を締め切りますか？\n\n※ 再延長・再登録ではありません。募集一覧から非表示になります。"
    );

  if (!ok) {
    return;
  }

  const {
    data,
    error
  } =
    await sb.rpc(
      "close_recruitment_by_pass",
      {
        p_pass_hash:
          loadedManagePassHash
      }
    );

  if (error) {
    console.error("募集締切エラー", error);
    alert("募集締切処理に失敗しました。");
    return;
  }

  if (data === "commander_confirm") {

    const {
      data: commanderClosed,
      error: commanderError
    } =
      await sb.rpc(
        "close_commander_recruitment_by_pass",
        {
          p_pass_hash:
            loadedManagePassHash,
          p_close_reason:
            "graduated"
        }
      );

    if (commanderError) {
      console.error(
        "指揮官募集締切エラー",
        commanderError
      );
      alert(
        "指揮官募集の締切処理に失敗しました。"
      );
      return;
    }

    if (commanderClosed !== true) {
      alert(
        "PASSが正しくないか、すでに募集終了しています。"
      );
      return;
    }

    alert(
      "🎓 ユニオン決定として募集を締め切りました。"
    );

    await loadGraduatedCommanderCount();

  } else {

    alert(
      "PASSが正しくないか、すでに募集終了しています。"
    );
    return;
  }

  clearLoadedManageRecruitment();
  $("#closeForm")?.reset();
  showPage("list");
}


$("#closeLoadedRecruitmentBtn")
  ?.addEventListener(
    "click",
    closeLoadedRecruitment
  );


// ========================================
// ユニオン会員解除
// 会員台帳から抹消し、再利用時は新規登録。
// ========================================

$("#deleteUnionMembershipBtn")
  ?.addEventListener(
    "click",
    async () => {

      if (
        !loadedManagedRecruitment
        ||
        loadedManagedRecruitment.type !== "union"
        ||
        !loadedManagePassHash
      ) {
        return;
      }

      const ok =
        window.confirm(
          "UNION MATCHから登録を削除しますか？\n\n・TOTAL UNIONSから外れます\n・募集中なら求人広告も終了します\n・BOTとのユニオン連携も解除されます\n・再利用する場合は新規登録が必要です"
        );

      if (!ok) {
        return;
      }

      const {
        data,
        error
      } =
        await sb.rpc(
          "delete_union_membership_by_pass",
          {
            p_pass_hash:
              loadedManagePassHash
          }
        );

      if (
        error
        ||
        data !== true
      ) {
        console.error(
          "ユニオン会員解除エラー",
          error || data
        );
        alert(
          "登録を削除できませんでした。"
        );
        return;
      }

      alert(
        "UNION MATCHから登録を削除しました。\n再び利用する場合は新規登録してください。"
      );

      clearLoadedManageRecruitment();
      $("#closeForm")?.reset();

      await loadRecruitments();
      await loadTotalRegisteredUnionCount();

      showPage("list");
    }
  );


// ========================================
// v15 VIDEO TOP UI
// ========================================

function getMobileScrollShell() {

  const isSmartphone =
    window.matchMedia(
      "(max-width: 600px)"
    ).matches;

  const isTabletDevice =
    document.documentElement
      .classList
      .contains(
        "tablet-device"
      );

  if (
    !isSmartphone
    &&
    !isTabletDevice
  ) {
    return null;
  }

  return document.getElementById(
    "mobileScrollShell"
  );

}


function getElementTopInsideMobileShell(
  element,
  shell
) {

  if (
    !element
    ||
    !shell
  ) {
    return 0;
  }

  return (
    shell.scrollTop
    +
    element.getBoundingClientRect().top
    -
    shell.getBoundingClientRect().top
  );

}


function scrollAppToTop(
  behavior = "smooth"
) {

  const shell =
    getMobileScrollShell();

  if (shell) {

    shell.scrollTo({
      top: 0,
      left: 0,
      behavior
    });

    return;
  }

  window.scrollTo({
    top: 0,
    left: 0,
    behavior
  });

}


function scrollAppElementToTop(
  element,
  behavior = "smooth"
) {

  if (!element) {
    return;
  }

  const shell =
    getMobileScrollShell();

  if (shell) {

    shell.scrollTo({
      top:
        Math.max(
          0,
          getElementTopInsideMobileShell(
            element,
            shell
          )
        ),
      left: 0,
      behavior
    });

    return;
  }

  element.scrollIntoView({
    behavior,
    block: "start"
  });

}


function scrollToVideoTop() {

  scrollAppToTop(
    "smooth"
  );

}


function returnToVideoTop() {

  closeSiteMenu?.();

  document.body.classList.remove(
    "register-mode",
    "manage-mode"
  );

  document
    .querySelectorAll(".page")
    .forEach(page => {
      page.classList.remove("active");
    });

  document
    .getElementById("listPage")
    ?.classList.add("active");

  document
    .querySelectorAll(".bottom-nav .nav-btn")
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.page === "list"
      );
    });

  mobileFooterHideUntilTop =
    true;

  document
    .getElementById(
      "bottomNav"
    )
    ?.classList
    .remove(
      "is-visible"
    );

  scrollAppToTop(
    "smooth"
  );

}


function closeSiteMenu() {

  document.body
    .classList
    .remove(
      "menu-open"
    );

  const button =
    document.getElementById(
      "siteMenuButton"
    );

  const drawer =
    document.getElementById(
      "siteMenuDrawer"
    );

  const backdrop =
    document.getElementById(
      "siteMenuBackdrop"
    );

  button?.setAttribute(
    "aria-expanded",
    "false"
  );

  drawer?.setAttribute(
    "aria-hidden",
    "true"
  );

  if (backdrop) {
    backdrop.hidden =
      true;
  }

}


function openSiteMenu() {

  document.body
    .classList
    .add(
      "menu-open"
    );

  const button =
    document.getElementById(
      "siteMenuButton"
    );

  const drawer =
    document.getElementById(
      "siteMenuDrawer"
    );

  const backdrop =
    document.getElementById(
      "siteMenuBackdrop"
    );

  button?.setAttribute(
    "aria-expanded",
    "true"
  );

  drawer?.setAttribute(
    "aria-hidden",
    "false"
  );

  if (backdrop) {
    backdrop.hidden =
      false;
  }

}


document
  .getElementById(
    "videoTopSwitch"
  )
  ?.addEventListener(
    "click",
    event => {

      event.preventDefault();
      event.stopPropagation();

      returnToVideoTop();

    }
  );


document
  .getElementById(
    "videoScrollButton"
  )
  ?.addEventListener(
    "click",
    () => {

      scrollAppElementToTop(
        document.getElementById(
          "listPage"
        ),
        "smooth"
      );

    }
  );


document
  .getElementById(
    "siteMenuButton"
  )
  ?.addEventListener(
    "click",
    () => {

      if (
        document.body
          .classList
          .contains(
            "menu-open"
          )
      ) {
        closeSiteMenu();
      } else {
        openSiteMenu();
      }

    }
  );


document
  .getElementById(
    "siteMenuClose"
  )
  ?.addEventListener(
    "click",
    closeSiteMenu
  );


document
  .getElementById(
    "siteMenuBackdrop"
  )
  ?.addEventListener(
    "click",
    closeSiteMenu
  );


document
  .querySelectorAll(
    "[data-menu-action]"
  )
  .forEach(
    button => {

      button
        .addEventListener(
          "click",
          () => {

            const action =
              button.dataset
                .menuAction;

            closeSiteMenu();

            if (
              action ===
              "top"
            ) {

              returnToVideoTop();

              return;
            }

            if (
              action ===
              "commander"
            ) {

              setSearchType(
                "commander"
              );

              showPage(
                "list"
              );

              return;
            }

            if (
              action ===
              "union"
            ) {

              setSearchType(
                "union"
              );

              showPage(
                "list"
              );

              return;
            }

            if (
              action ===
              "register"
            ) {

              showPage(
                "register"
              );

              return;
            }

            if (
              action ===
              "manage"
            ) {

              showPage(
                "manage"
              );

            }

          }
        );

    }
  );


document
  .addEventListener(
    "keydown",
    event => {

      if (
        event.key ===
        "Escape"
      ) {
        closeSiteMenu();
      }

    }
  );


// 白い募集エリアまで来た時だけ
// スマホ / タブレット下部メニューを表示
const bottomNavigation =
  document.getElementById(
    "bottomNav"
  );

const listPageForNav =
  document.getElementById(
    "listPage"
  );

const mobileScrollShell =
  getMobileScrollShell();

let mobileFooterFramePending =
  false;

let mobileFooterHideUntilTop =
  false;


function updateMobileFooterVisibility() {

  if (
    !bottomNavigation
    ||
    !mobileScrollShell
    ||
    !listPageForNav
  ) {
    return;
  }

  const forceVisible =
    document.body
      .classList
      .contains(
        "register-mode"
      )
    ||
    document.body
      .classList
      .contains(
        "manage-mode"
      );

  if (forceVisible) {

    bottomNavigation
      .classList
      .add(
        "is-visible"
      );

    return;
  }

  /*
    TOPへ戻る操作中は、途中のスクロール位置で
    フッターが再表示されないように固定で隠す。
  */
  if (mobileFooterHideUntilTop) {

    bottomNavigation
      .classList
      .remove(
        "is-visible"
      );

    if (
      mobileScrollShell.scrollTop
        <= 8
    ) {
      mobileFooterHideUntilTop =
        false;
    }

    return;
  }

  /*
    スクロールを始めた直後にフッターを先にフェード表示。
    白いカードが上がって来るより先に出るので、
    レイヤーの切替感を目立たせない。
  */
  const revealAt =
    12;

  const hideAt =
    2;

  const footerIsVisible =
    bottomNavigation
      .classList
      .contains(
        "is-visible"
      );

  /*
    v37 smartphone footer hysteresis:
    hidden -> show at 12px
    visible -> hide only when nearly back at TOP (2px)
    No timer is used.
  */
  const shouldShow =
    footerIsVisible
      ? mobileScrollShell.scrollTop > hideAt
      : mobileScrollShell.scrollTop >= revealAt;

  bottomNavigation
    .classList
    .toggle(
      "is-visible",
      shouldShow
    );

}


function scheduleMobileFooterUpdate() {

  if (mobileFooterFramePending) {
    return;
  }

  mobileFooterFramePending =
    true;

  window
    .requestAnimationFrame(
      () => {

        mobileFooterFramePending =
          false;

        updateMobileFooterVisibility();

      }
    );

}


if (
  bottomNavigation
  &&
  listPageForNav
) {

  if (mobileScrollShell) {

    mobileScrollShell
      .addEventListener(
        "scroll",
        scheduleMobileFooterUpdate,
        {
          passive:
            true
        }
      );

    window
      .addEventListener(
        "resize",
        scheduleMobileFooterUpdate
      );

    window
      .requestAnimationFrame(
        updateMobileFooterVisibility
      );

  } else {

    /* Tablet keeps the existing behavior. */
    const bottomNavObserver =
      new IntersectionObserver(
        entries => {

          const visible =
            entries.some(
              entry =>
                entry.isIntersecting
                &&
                entry.boundingClientRect.top <=
                  window.innerHeight * 0.90
            );

          bottomNavigation
            .classList
            .toggle(
              "is-visible",
              visible
            );

        },
        {
          root:
            null,
          threshold:
            0,
          rootMargin:
            "0px 0px -10% 0px"
        }
      );

    bottomNavObserver
      .observe(
        listPageForNav
      );

  }

}


// register/manage時は常用ナビとして表示
const bodyModeObserver =
  new MutationObserver(
    () => {

      if (!bottomNavigation) {
        return;
      }

      const forceVisible =
        document.body
          .classList
          .contains(
            "register-mode"
          )
        ||
        document.body
          .classList
          .contains(
            "manage-mode"
          );

      if (forceVisible) {

        bottomNavigation
          .classList
          .add(
            "is-visible"
          );

        return;
      }

      if (mobileScrollShell) {
        scheduleMobileFooterUpdate();
      }

    }
  );

bodyModeObserver
  .observe(
    document.body,
    {
      attributes:
        true,
      attributeFilter:
        [
          "class"
        ]
    }
  );


// BOT / Creatorページからのリンク
function applyInitialRecruitmentView() {

  const params =
    new URLSearchParams(
      window.location.search
    );

  const requestedView =
    params.get(
      "view"
    );

  if (
    requestedView ===
    "union"
  ) {

    setSearchType(
      "union"
    );

  } else if (
    requestedView ===
    "commander"
  ) {

    setSearchType(
      "commander"
    );

  }

  const requestedHash =
    window.location.hash;

  // BOT / Creator のハンバーガー・フッターから
  // 募集登録 / PASS管理へ直接入れるようにする。
  // 既存の showPage() を使い、画面切替ロジックは増やさない。
  if (requestedHash === "#registerPage") {
    showPage("register");
    return;
  }

  if (requestedHash === "#managePage") {
    showPage("manage");
    return;
  }

  if (
    requestedHash ===
    "#listPage"
  ) {

    setTimeout(
      () => {

        const listPage =
          document.getElementById(
            "listPage"
          );

        if (!listPage) {
          return;
        }

        if (
          document.documentElement
            .classList
            .contains(
              "tablet-device"
            )
        ) {

          mobileFooterHideUntilTop =
            false;

          scrollAppElementToTop(
            listPage,
            "auto"
          );

          document
            .getElementById(
              "bottomNav"
            )
            ?.classList
            .add(
              "is-visible"
            );

          return;
        }

        listPage
          .scrollIntoView({
            behavior:
              "auto",
            block:
              "start"
          });

      },
      180
    );

  }

}


// ========================================
// 起動
// ========================================

// アクセス解析は失敗しても本体へ影響させない
recordSiteAccess();

setSearchType(
  "commander"
);

applyInitialRecruitmentView();

// ========================================
// v51.4 スマホ / タブレット登録フォーム
// キーボード追従 + 登録確認モーダル visual viewport 対応
// 登録画面のみに限定し、他ページの挙動は変更しない。
// ========================================
(() => {

  const root = document.documentElement;
  const body = document.body;
  const visualViewport = window.visualViewport || null;
  const mobileQuery = window.matchMedia("(max-width: 1024px)");

  let baselineViewportHeight =
    visualViewport?.height || window.innerHeight || 0;

  let followFrame = 0;
  let lastLayoutWidth = window.innerWidth;

  function isTabletDevice() {
    return root.classList.contains("tablet-device");
  }

  function isMobileFormLayout() {
    return mobileQuery.matches || isTabletDevice();
  }

  function isEditableField(element) {
    if (!element || !(element instanceof HTMLElement)) {
      return false;
    }

    if (element.tagName === "TEXTAREA") {
      return true;
    }

    if (element.tagName !== "INPUT") {
      return false;
    }

    const type = String(element.getAttribute("type") || "text").toLowerCase();

    return ![
      "button",
      "submit",
      "reset",
      "checkbox",
      "radio",
      "file",
      "hidden",
      "range",
      "color"
    ].includes(type);
  }

  function activeRegisterField() {
    if (!body.classList.contains("register-mode")) {
      return null;
    }

    const active = document.activeElement;

    if (!isEditableField(active)) {
      return null;
    }

    return active.closest("#registerPage") ? active : null;
  }

  function readViewportMetrics() {
    const height =
      visualViewport?.height || window.innerHeight || 0;

    const offsetTop =
      Math.max(0, visualViewport?.offsetTop || 0);

    const activeField = activeRegisterField();

    /* キーボードが閉じている時にだけ通常時の最大高さを更新。
       アドレスバーの開閉では基準値が自然に追従する。 */
    if (!activeField && height > 0) {
      baselineViewportHeight =
        Math.max(baselineViewportHeight, height);
    }

    const keyboardHeight =
      Math.max(0, baselineViewportHeight - height);

    return {
      height,
      offsetTop,
      keyboardHeight,
      keyboardOpen:
        Boolean(activeField) && keyboardHeight >= 110
    };
  }

  function updateMobileLayoutClass() {
    root.classList.toggle(
      "form-mobile-layout",
      isMobileFormLayout()
    );
  }

  function updateViewportState() {
    updateMobileLayoutClass();

    const metrics = readViewportMetrics();
    const field = activeRegisterField();

    root.style.setProperty(
      "--app-vv-height",
      `${Math.max(1, Math.round(metrics.height))}px`
    );

    root.style.setProperty(
      "--app-vv-offset-top",
      `${Math.round(metrics.offsetTop)}px`
    );

    root.style.setProperty(
      "--app-keyboard-height",
      `${Math.round(metrics.keyboardHeight)}px`
    );

    body.classList.toggle(
      "form-input-active",
      isMobileFormLayout() && Boolean(field)
    );

    body.classList.toggle(
      "form-keyboard-open",
      isMobileFormLayout() && metrics.keyboardOpen
    );

    if (field) {
      scheduleFieldFollow(field, false);
    }
  }

  function followField(field, smooth = true) {
    if (
      !isMobileFormLayout()
      ||
      !body.classList.contains("register-mode")
      ||
      !isEditableField(field)
      ||
      !field.closest("#registerPage")
    ) {
      return;
    }

    const shell =
      document.getElementById("mobileScrollShell");

    if (!shell) {
      return;
    }

    const metrics = readViewportMetrics();
    const rect = field.getBoundingClientRect();

    /* 66pxヘッダーの下に少し余白を取り、
       下側はキーボードのすぐ上に約80pxの作業領域を残す。 */
    const safeTop =
      metrics.offsetTop + 82;

    const safeBottom =
      metrics.offsetTop + metrics.height - 20;

    const reserveBelowField =
      metrics.keyboardOpen ? 84 : 34;

    let delta = 0;

    if (rect.bottom + reserveBelowField > safeBottom) {
      delta =
        rect.bottom + reserveBelowField - safeBottom;
    } else if (rect.top < safeTop) {
      delta = rect.top - safeTop;
    }

    if (Math.abs(delta) < 2) {
      return;
    }

    shell.scrollBy({
      top: delta,
      left: 0,
      behavior: smooth ? "smooth" : "auto"
    });
  }

  function scheduleFieldFollow(field, smooth = true) {
    if (followFrame) {
      cancelAnimationFrame(followFrame);
    }

    followFrame = requestAnimationFrame(() => {
      followFrame = 0;
      followField(field, smooth);
    });
  }

  function settleFocusedField(field) {
    /* iOS / Androidでキーボードの開く速度が違うため、
       3段階だけ追従して最終位置を合わせる。 */
    [60, 180, 320].forEach((delay, index) => {
      setTimeout(() => {
        updateViewportState();
        followField(field, index === 0);
      }, delay);
    });
  }

  document.addEventListener(
    "focusin",
    event => {
      const field = event.target;

      if (
        !isMobileFormLayout()
        ||
        !body.classList.contains("register-mode")
        ||
        !isEditableField(field)
        ||
        !field.closest("#registerPage")
      ) {
        return;
      }

      body.classList.add("form-input-active");
      updateViewportState();
      settleFocusedField(field);
    },
    true
  );

  document.addEventListener(
    "focusout",
    () => {
      setTimeout(() => {
        updateViewportState();
      }, 80);
    },
    true
  );

  function handleViewportChange() {
    const width = window.innerWidth;

    /* 端末回転時だけ基準高さを作り直す。 */
    if (Math.abs(width - lastLayoutWidth) > 80) {
      lastLayoutWidth = width;
      baselineViewportHeight =
        visualViewport?.height || window.innerHeight || baselineViewportHeight;
    }

    updateViewportState();
  }

  window.addEventListener(
    "resize",
    handleViewportChange,
    { passive: true }
  );

  visualViewport?.addEventListener(
    "resize",
    handleViewportChange,
    { passive: true }
  );

  visualViewport?.addEventListener(
    "scroll",
    handleViewportChange,
    { passive: true }
  );

  if (typeof mobileQuery.addEventListener === "function") {
    mobileQuery.addEventListener(
      "change",
      handleViewportChange
    );
  }

  /* 登録確認モーダル表示時、visual viewport の最新値を即反映。 */
  const previewModal =
    document.getElementById("registrationPreviewModal");

  if (previewModal) {
    const previewObserver =
      new MutationObserver(() => {
        if (!previewModal.classList.contains("hidden")) {
          updateViewportState();

          requestAnimationFrame(() => {
            previewModal.scrollTop = 0;

            const previewCard =
              document.getElementById("registrationPreviewCard");

            if (previewCard) {
              previewCard.scrollTop = 0;
            }
          });
        }
      });

    previewObserver.observe(
      previewModal,
      {
        attributes: true,
        attributeFilter: ["class"]
      }
    );
  }

  updateViewportState();

})();

// ========================================
// v51.7 登録最終確認画面 安定化
// PC / smartphone / tablet 共通
// - 実際の上部メニューバー下端を取得
// - 最終確認中だけ下部固定ナビを隠す
// - 開くたびスクロール先頭へ戻す
// ========================================
(() => {
  const root = document.documentElement;
  const body = document.body;
  const modal = document.getElementById("registrationPreviewModal");
  const topbar = document.querySelector(".topbar");

  if (!body || !modal) {
    return;
  }

  let wasOpen = false;
  let syncFrame = 0;

  function updatePreviewViewportMetrics() {
    const rect = topbar?.getBoundingClientRect();

    /*
      上端は実際のヘッダー高さ、縦幅は visualViewport を使用する。
      iPhone / iPad のアドレスバー・下部ブラウザUIが出入りしても、
      最終確認画面のスクロール領域を「今見えている画面」に合わせる。
    */
    const headerHeight =
      Number.isFinite(rect?.height) && rect.height > 0
        ? rect.height
        : 66;

    const viewportHeight =
      window.visualViewport?.height
      ||
      window.innerHeight
      ||
      document.documentElement.clientHeight
      ||
      1;

    const safeTop =
      Math.max(0, Math.round(headerHeight));

    const availableHeight =
      Math.max(180, Math.round(viewportHeight - safeTop));

    root.style.setProperty(
      "--registration-preview-top",
      `${safeTop}px`
    );

    root.style.setProperty(
      "--registration-preview-height",
      `${availableHeight}px`
    );
  }

  function syncRegistrationPreviewLayout() {
    updatePreviewViewportMetrics();

    const open = !modal.classList.contains("hidden");

    body.classList.toggle(
      "registration-preview-open",
      open
    );

    if (open && !wasOpen) {
      requestAnimationFrame(() => {
        modal.scrollTop = 0;

        const previewCard =
          document.getElementById("registrationPreviewCard");

        if (previewCard) {
          previewCard.scrollTop = 0;
        }
      });
    }

    wasOpen = open;
  }

  function schedulePreviewLayoutSync() {
    if (syncFrame) {
      cancelAnimationFrame(syncFrame);
    }

    syncFrame = requestAnimationFrame(() => {
      syncFrame = 0;
      syncRegistrationPreviewLayout();
    });
  }

  const observer = new MutationObserver(
    schedulePreviewLayoutSync
  );

  observer.observe(
    modal,
    {
      attributes: true,
      attributeFilter: ["class"]
    }
  );

  window.addEventListener(
    "resize",
    schedulePreviewLayoutSync,
    { passive: true }
  );

  window.visualViewport?.addEventListener(
    "resize",
    schedulePreviewLayoutSync,
    { passive: true }
  );

  window.visualViewport?.addEventListener(
    "scroll",
    schedulePreviewLayoutSync,
    { passive: true }
  );

  syncRegistrationPreviewLayout();
})();

