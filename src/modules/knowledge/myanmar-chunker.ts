/**
 * Advanced Manual chunking utility optimized for the Myanmar language.
 * Solves: Orphaned headings, Cross-paragraph overlapping, and Word-breaking issues.
 */
export function chunkMyanmarText(
  text: string,
  maxChunkSize = 800, // အသင့်တော်ဆုံး Size
  overlap = 150       // အသင့်တော်ဆုံး Overlap
): string[] {
  if (!text) return [];

  // 1. စာသားတစ်ခုလုံးကို အသေးငယ်ဆုံး Text Units များအဖြစ် အရင် ဖြိုခွဲပါမယ်
  const rawParagraphs = text.split(/\r?\n+/);
  const units: string[] = [];

  for (const para of rawParagraphs) {
    const p = para.trim();
    if (!p) continue;

    // စာပိုဒ်က သေးနေရင် Unit တစ်ခုတည်းအနေနဲ့ ထားမယ်၊ ကြီးနေရင် မြန်မာပုဒ်မတွေနဲ့ ထပ်ခွဲမယ်
    if (p.length <= maxChunkSize) {
      units.push(p);
    } else {
      const sentences = p.split(/(?<=[။၊])/g);
      sentences.forEach(s => {
        const trimmed = s.trim();
        if (trimmed) units.push(trimmed);
      });
    }
  }

  const chunks: string[] = [];
  let currentChunk = '';

  // Helper Function: Overlap ယူတဲ့အခါ စာလုံးထက်ပိုင်းမပြတ်အောင် Space (သို့) ပုဒ်မ ကနေ ရှာဖြတ်ပေးခြင်း
  const getSafeOverlap = (textStr: string, overlapSize: number) => {
    if (textStr.length <= overlapSize) return textStr;
    const slice = textStr.slice(-overlapSize);
    
    // Space (' ') ဒါမှမဟုတ် မြန်မာပုဒ်မ တွေကနေ စာကြောင်းမပြတ်အောင် လိုက်ရှာပါမယ်
    const safeCutIndex = slice.search(/[ ။၊]/); 
    return safeCutIndex !== -1 ? slice.slice(safeCutIndex).trim() : slice;
  };

  // 2. ရလာတဲ့ Text Units လေးတွေကို Max Size မပြည့်မချင်း ပြန်ပေါင်းပါမယ် (Aggregation)
  for (const unit of units) {
    // Edge Case: Unit တစ်ခုတည်းက Max Size ထက် ကြီးနေသေးရင် (ဥပမာ - ပုဒ်မ လုံးဝမပါတဲ့ စာပိုဒ်ရှည်ကြီး)
    if (unit.length > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = getSafeOverlap(currentChunk, overlap);
      }

      let remaining = unit;
      while (remaining.length > 0) {
        const slice = remaining.substring(0, maxChunkSize);
        chunks.push(slice.trim());
        remaining = remaining.substring(maxChunkSize - overlap);
        if (remaining.length <= overlap) break;
      }
      currentChunk = ''; 
      continue;
    }

    // လက်ရှိ Chunk ထဲကို Unit အသစ် ထပ်ထည့်ကြည့်ပါမယ်
    const separator = currentChunk ? ' ' : '';
    const potentialLength = currentChunk.length + separator.length + unit.length;

    if (potentialLength <= maxChunkSize) {
      // Max Size မပြည့်သေးရင် ဆက်ပေါင်းမယ် (ဒါက Heading လေးတွေကို နောက်စာပိုဒ်နဲ့ အလိုလို ပေါင်းပေးသွားပါမယ်)
      currentChunk += separator + unit;
    } else {
      // Max Size ကျော်သွားပြီဆိုရင် လက်ရှိ Chunk ကို သိမ်းမယ်
      chunks.push(currentChunk.trim());
      // အရှေ့ Chunk ရဲ့ Overlap ကိုယူပြီး နောက် Chunk အသစ်အတွက် အစပြုပေးပါမယ် (Cross-paragraph Overlap)
      currentChunk = getSafeOverlap(currentChunk, overlap) + ' ' + unit;
    }
  }

  // ကျန်နေခဲ့တဲ့ နောက်ဆုံး Chunk ကို ထည့်မယ်
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}