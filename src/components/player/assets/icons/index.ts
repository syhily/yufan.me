import loading from './loading.svg?raw';
import loopAll from './loop-all.svg?raw';
import loopNone from './loop-none.svg?raw';
import loopOne from './loop-one.svg?raw';
import lrc from './lrc.svg?raw';
import menu from './menu.svg?raw';
import orderList from './order-list.svg?raw';
import orderRandom from './order-random.svg?raw';
import pause from './pause.svg?raw';
import play from './play.svg?raw';
import right from './right.svg?raw';
import skip from './skip.svg?raw';
import volumeDown from './volume-down.svg?raw';
import volumeOff from './volume-off.svg?raw';
import volumeUp from './volume-up.svg?raw';

const Icons = {
  play: play,
  pause: pause,
  volumeUp: volumeUp,
  volumeDown: volumeDown,
  volumeOff: volumeOff,
  orderRandom: orderRandom,
  orderList: orderList,
  menu: menu,
  loopAll: loopAll,
  loopOne: loopOne,
  loopNone: loopNone,
  loading: loading,
  right: right,
  skip: skip,
  lrc: lrc,
};

// This is used for both the astro template and the frontend VanillaJS
export default Icons;
