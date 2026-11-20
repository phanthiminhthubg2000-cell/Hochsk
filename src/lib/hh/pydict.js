// Sửa pinyin cho pinyin-pro (chữ đa âm trong ngữ cảnh huyền học) + toàn bộ từ vựng khoá học (pinyin gõ tay)
import { ALL_VOCAB } from "./index";
const EXTRA = {
  引申为: "yǐn shēn wéi", 为木: "wéi mù", 为火: "wéi huǒ", 为土: "wéi tǔ", 为金: "wéi jīn", 为水: "wéi shuǐ", 为界: "wéi jiè", 为头: "wéi tóu", 为中心: "wéi zhōng xīn", 为偏: "wéi piān", 为正: "wéi zhèng", 为格: "wéi gé", 一行: "yì xíng", 另一行: "lìng yì xíng", 藏着: "cáng zhe",
  五行: "wǔ xíng", 利见大人: "lì jiàn dà rén", 相传: "xiāng chuán", 乾: "qián", 乾卦: "qián guà", 乾乾: "qián qián", 乾为天: "qián wéi tiān", 否: "pǐ", 否卦: "pǐ guà", 否极泰来: "pǐ jí tài lái", 屯: "zhūn",
  长夏: "cháng xià", 长男: "zhǎng nán", 长女: "zhǎng nǚ", 少阳: "shào yáng", 少阴: "shào yīn", 少男: "shào nán", 少女: "shào nǚ", 重阴: "chóng yīn", 重阳: "chóng yáng",
  见龙: "xiàn lóng", 亢龙: "kàng lóng", 天行健: "tiān xíng jiàn", 星宿: "xīng xiù", 面相: "miàn xiàng", 手相: "shǒu xiàng", 属相: "shǔ xiang", 卜: "bǔ", 占卜: "zhān bǔ",
  相生: "xiāng shēng", 相克: "xiāng kè", 相冲: "xiāng chōng", 相乘: "xiāng chéng", 相侮: "xiāng wǔ", 相薄: "xiāng bó", 相射: "xiāng yì", 稼穑: "jià sè", 爰: "yuán",
  命相: "mìng xiàng", 山医命相卜: "shān yī mìng xiàng bǔ", 噬嗑: "shì kè", 兑: "duì", 泽: "zé", 大畜: "dà xù", 小畜: "xiǎo xù", 艮: "gèn", 巽: "xùn",
  阳爻: "yáng yáo", 阴爻: "yīn yáo", 爻: "yáo", 宜: "yí", 煞: "shà", 冲煞: "chōng shà", 纳音: "nà yīn", 行丧: "xíng sāng", 时辰: "shí chen", 得令: "dé lìng", 当令: "dāng lìng", 月令: "yuè lìng",
};
export const PY_DICT = (() => {
  const d = {};
  for (const v of ALL_VOCAB) { const s = v.py.trim().split(/\s+/); if (s.length > 1 && s.length === [...v.zh].length && /^[一-鿿]+$/.test(v.zh)) d[v.zh] = v.py.toLowerCase() === v.py ? v.py : v.py.toLowerCase(); }
  return { ...d, ...EXTRA };
})();
