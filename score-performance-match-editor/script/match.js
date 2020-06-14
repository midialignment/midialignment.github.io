/**
 * match の各ノート情報を格納するクラス
 */
class ScorePerfmMatchEvt{
	constructor(){
		this.ID = "";
		this.ontime = 0.0;
		this.offtime = 0.0;
		this.sitch = "";
		this.onvel = 0;
		this.offvel = 0;
		this.channel = 0;
		this.matchStatus = 0;
		this.stime = 0;
		this.fmt1ID = "";
		this.errorInd = 0;
		this.skipInd = "";
		this.rep = "";//Simplified fmt1ID
		this.orgRep = "";//Simplified fmt1ID
	}

	/**
	 * match ファイルから読み込みしたものを格納
	 * @param {Array} event 
	 */
	fromFileEvt(event){
		this.ID = String(event[0]);
		this.ontime = Number(event[1]);
		this.offtime = Number(event[2]);
		this.sitch = String(event[3]);
		this.onvel = Number(event[4]);
		this.offvel = Number(event[5]);
		this.channel = Number(event[6]);
		this.matchStatus = Number(event[7]);
		this.stime = Number(event[8]);
		this.fmt1ID = String(event[9]);
		this.errorInd = Number(event[10]);
		this.skipInd = String(event[11]);
		this.rep = "";//Simplified fmt1ID
		this.orgRep = "";//Simplified fmt1ID
		return;
	}

}


/**
 * match ファイル内の missing note 情報を格納するノート
 */
class MissingNote{
	constructor(){
		this.stime = 0;
		this.fmt1ID = "";
	}

	/**
	 * ファイルから読み込み
	 * @param {Array} event 
	 */
	readFromFile(event){
		this.stime = Number(event[1]);
		this.fmt1ID = String(event[2]);
		return;
	}
}