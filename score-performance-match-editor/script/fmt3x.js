/**
 * fmt3x の情報を格納するクラス
 */
class Fmt3xEvent{
	constructor(){
		this.stime = 0; // tick で表した発音時刻
		this.barNum = ""; // string 小節番号
		this.staff = 0; // 1: 上段, 2: 下段
		this.voice = 0;
		this.subVoice = 0;
		this.subOrder = 0;
		this.eventType = ""; // chord / rest / short-app / tremolo
		this.duration = 0; // tick 単位での長さ
		this.numNotes = 0; // 音符数
		this.sitches = []; // 英語での音名
		this.noteTypes = []; // N.. : 通常，Tr : トリル
		this.fmt1IDs = []; // 固有ID
		this.arpFerInfo = [];
	}

	/**
	 * ファイルから読み込み
	 * @param {Array} event 
	 */
	fromFileEvt(event){
		const DATANUM = 9;

		// 各要素の読み込み
		let stime = Number(event[0]);
		let barNum = String(event[1]);
		let staff = Number(event[2]);
		let voice = Number(event[3]);
		let subVoice = Number(event[4]);
		let subOrder = Number(event[5]);
		let eventType = String(event[6]);
		let duration = Number(event[7]);
		let numNotes = Number(event[8]);

		// 配列の初期化
		let sitchesDataArray = [];
		let notetypesDataArray = [];
		let fmt1IDDataArray = [];
		let arpFerInfoArray = [];

		// sitch の格納
		for (let j = 0; j < numNotes; j++){
			let idx = j + DATANUM;
			let sitchData = String(event[idx]);
			sitchesDataArray.push(sitchData);
		}
		let sitches = sitchesDataArray;

		// notetypes の格納
		for (let j = 0; j < numNotes; j++){
			let idx = j + DATANUM + numNotes;
			let notetypesData = String(event[idx]);
			notetypesDataArray.push(notetypesData);
		}
		let noteTypes = notetypesDataArray;

		// fmt1ID の格納
		for (let j = 0; j < numNotes; j++){
			let idx = j + DATANUM + 2 * numNotes;
			let fmt1IDData = String(event[idx]);
			fmt1IDDataArray.push(fmt1IDData);
		}
		let fmt1IDs = fmt1IDDataArray;

		// セット
		this.stime = stime;
		this.barNum = barNum;
		this.staff = staff;
		this.voice = voice;
		this.subVoice = subVoice;
		this.subOrder = subOrder;
		this.eventType = eventType;
		this.duration = duration;
		this.numNotes = numNotes;
		this.sitches = sitches;
		this.noteTypes = noteTypes;
		this.fmt1IDs = fmt1IDs;
		
		return;
	}

}//endclass Fmt3xEvent


