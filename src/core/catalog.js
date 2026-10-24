/**
 * KRT-001 · 构件目录与讲解文案（纯数据，无 DOM）
 *
 * 规划案 §3.2 C05「八热点与目录」与 §4「文博解释」：
 *  - 每条记录含中文名称、结构作用、可观测依据、H/I/S 置信标签、资料来源、推断偏差。
 *  - 第三段固定强调「非专业测绘成果」。
 *  - 不得虚构乾隆诗或《文心雕龙》正文（规划案 §5.2 彩画/匾额条）。
 *
 * @typedef {'H'|'I'|'S'} Confidence
 * @typedef {{id:string,category:string,confidence:Confidence,
 *   title:string,description:string,source:string,anchor:[number,number,number]}} PartRecord
 */

const DISCLAIMER =
  '本页为程序化复原成果，不是文物测绘或激光扫描数据；尺寸依据公开史料与清式营造则例推算，' +
  '与实测可能存在偏差，不应作为修缮或研究依据。';

/** @type {ReadonlyArray<PartRecord>} */
export const PARTS = Object.freeze([
  Object.freeze({
    id: 'roof-double-eave',
    category: '屋面',
    confidence: 'H',
    title: '重檐八脊攒尖顶',
    description:
      '结构作用：八条垂脊自宝顶放射下垂，形成攒尖屋面；上下两道屋檐既压低进光，' +
      '又让出深远出檐与柱网之间的观景视野。可观测依据：下檐与上檐各自成一套斗栱与举折，' +
      '上檐八条主脊、下檐另八条放射脊，共十六个吻兽。' +
      `推断偏差：檐口半径、举折曲线与瓦垄节距均为依营造则例的推算值，不是实测。${DISCLAIMER}`,
    source: '简报 H：百度百科 / maigoo「重檐八脊攒尖圆宝顶」；曲线公式见规划案 §5.2',
    anchor: [8.0, 6.4, 4.6],
  }),
  Object.freeze({
    id: 'brackets-dougong',
    category: '木构',
    confidence: 'H',
    title: '斗栱',
    description:
      '结构作用：斗栱把檐口荷载一层层传到柱头，同时把屋檐挑出到柱网之外；' +
      '它也是判定建筑等级与时代的重要标志。可观测依据：每根外檐柱头一组，' +
      '柱间按间距另加，简化后共二十四主组，上檐另有八组。' +
      `推断偏差：本复原采用三层简化斗栱并标注为 I 级，不冒充特定清式标准件；真实踩数与层数未查证。${DISCLAIMER}`,
    source: '简报 H：斗栱上檐周围枋檩饰旋子大点金彩画；尺寸为规划案 §5.2 推算',
    anchor: [11.3, 5.35, 0.9],
  }),
  Object.freeze({
    id: 'painting-xuanzi',
    category: '彩画',
    confidence: 'H',
    title: '旋子大点金彩画',
    description:
      '结构作用：彩画既是保护木构的漆层，也是等级与规制的视觉标识。' +
      '可观测依据：斗栱上檐周围枋檩全部饰以旋子大点金彩画；1955 年为节省开支，' +
      '将金线大点金改为墨线大点金。' +
      `推断偏差：本复原以程序化纹样近似呈现旋花节奏与金线，不仿造无法确认的真迹图案。${DISCLAIMER}`,
    source: '简报 H：百度百科「斗拱上檐周围枋檩上全部饰以旋子大点金彩画」',
    anchor: [10.9, 5.02, 3.6],
  }),
  Object.freeze({
    id: 'ceiling-caojing',
    category: '天花',
    confidence: 'H',
    title: '藻井',
    description:
      '结构作用：藻井是亭内顶部的装饰性天花，用层层收分的木构把视觉引向宝顶，' +
      '同时遮蔽上部梁架。可观测依据：亭内有藻井天花，本复原做成有实际深度的三层递进八角斗形。' +
      `推断偏差：藻井的内切半径、层数与莲纹位置为推算，未见测绘图。${DISCLAIMER}`,
    source: '简报 H：百度百科「藻井天花」；尺寸见规划案 §5.2',
    anchor: [0, 7.5, 0],
  }),
  Object.freeze({
    id: 'plaques-inner',
    category: '题额',
    confidence: 'H',
    title: '亭内八块木匾',
    description:
      '结构作用：匾额是建筑立面的题咏载体，也记录了使用者的政治姿态。' +
      '可观测依据：亭内枋梁上现挂八块木匾，其中两块为乾隆御制诗，' +
      '六块为光绪朝大臣所撰，内容取自《文心雕龙》。' +
      `推断偏差：本复原只标注匾额的位置与形制，不书写未经核对的匾文。${DISCLAIMER}`,
    source: '简报 H：百度百科「亭内枋梁上现挂八块木匾」；博雅地名网补记《文心雕龙》六篇目',
    anchor: [3.0, 4.35, 3.0],
  }),
  Object.freeze({
    id: 'columns-three-rings',
    category: '柱网',
    confidence: 'H',
    title: '内外三圈四十柱',
    description:
      '结构作用：外圈檐柱承托下檐，中圈与内圈向上支撑藻井与宝顶；' +
      '三圈同心布局让亭内形成层层收分的空间层次。可观测依据：' +
      '内外三圈共四十根柱子，其中二十四根圆柱、十六根方柱。' +
      `推断偏差：柱高 4.29 米为史料所载；中圈与内圈的半径分配为本复原的推算。${DISCLAIMER}`,
    source: '简报 H：百度百科「由内外三圈共40根柱子支撑，其中24根圆柱、16根方柱」',
    anchor: [11.6, 3.2, 0],
  }),
  Object.freeze({
    id: 'platform-terrace',
    category: '台基',
    confidence: 'H',
    title: '八方月台与宇墙',
    description:
      '结构作用：月台把亭身托举到湖岸视线之上，宇墙与木栅栏门界定可停留的观景范围。' +
      '可观测依据：亭四周建有八方形月台，边长 11.1 米，环绕月台砌着 1 米多高的宇墙，' +
      '宇墙四面各建一座木栅栏门。' +
      `推断偏差：月台以外的台明高度、踏跺级数与围墙细部形制为推算。${DISCLAIMER}`,
    source: '简报 H：百度百科「八方形的月台，边长11.1米」',
    anchor: [12.6, 0.95, 0],
  }),
  Object.freeze({
    id: 'finial-and-beasts',
    category: '脊饰',
    confidence: 'H',
    title: '圆宝顶与十六吻兽',
    description:
      '结构作用：宝顶收束攒尖顶的顶点，吻兽守住垂脊端部、压住脊瓦并避雷。' +
      '可观测依据：顶部为重檐八脊攒尖圆宝顶结构，藻井天花有十六吻兽。' +
      `推断偏差：吻兽的具体形象、尺寸与排布在史料中只给出数量；宝顶材质按实景照片的素色处理。${DISCLAIMER}`,
    source: '简报 H：百度百科「顶部重檐八脊攒尖圆宝顶结构」「有十六吻兽」',
    anchor: [0, 10.05, 0],
  }),
]);

const BY_ID = new Map(PARTS.map((p) => [p.id, p]));

/**
 * 全部构件记录（只读）。
 * @returns {ReadonlyArray<PartRecord>}
 */
export function listParts() {
  return PARTS;
}

/**
 * 按 ID 取构件记录。
 * @param {string} id
 * @returns {PartRecord|undefined}
 */
export function getPart(id) {
  return BY_ID.get(id);
}

/**
 * 判断 ID 是否是已知构件。
 * @param {string} id
 * @returns {boolean}
 */
export function isKnownPart(id) {
  return BY_ID.has(id);
}

/**
 * 「复原依据」面板的资料来源清单。
 * @returns {ReadonlyArray<{label:string, level:string, text:string}>}
 */
export function listSources() {
  return Object.freeze([
    Object.freeze({
      label: '形制与历史（H）',
      level: 'H',
      text:
        '廓如亭平面呈八方形、每面显三间；内外三圈共四十柱（二十四圆柱、十六方柱）；' +
        '柱高 4.29 米；顶部重檐八脊攒尖圆宝顶；亭内有藻井天花与十六吻兽；' +
        '八方月台边长 11.1 米、四周砌一米多高宇墙并各设木栅栏门；' +
        '亭内枋梁悬八块木匾（两块乾隆御制诗、六块光绪朝臣撰，出《文心雕龙》）。',
    }),
    Object.freeze({
      label: '尺寸推算（I）',
      level: 'I',
      text:
        '建筑投影按简报所记建筑面积 384.95 平方米等面积推算为边长 8.931 米的正八边形；' +
        '柱础、枋檩、斗栱、雀替、藻井、瓦垄节距与举折曲线均依清工部《工程做法则例》' +
        '（柱高与柱径 11:1、收分 7/1000、檐步五举等）推算，属复原假设而非测绘值。',
    }),
    Object.freeze({
      label: '远景构图（S）',
      level: 'S',
      text:
        '东堤、十七孔桥、南湖岛、万寿山与佛香阁的方位与距离仅为画面构图服务，' +
        '未与真实地理测绘核对，也不作为位置说明展示。',
    }),
    Object.freeze({
      label: '瓦色说明',
      level: 'H',
      text:
        '廓如亭屋面按公开实景照片处理为青灰筒瓦配青绿脊饰，而非部分颐和园建筑惯用的黄琉璃；' +
        '宝顶亦按素色处理。',
    }),
  ]);
}
