const LEGER_WIDTH = 1;
const PX_PER_SEC = 200;
const X_OFFSET = 100; // X 座標左端
const X_POS_CORRECTION = X_OFFSET - 500; // 移動時の X 座標補正
const TAB = String.fromCharCode(9);
const SPACE = String.fromCharCode(32);
const SEC_PER_LINE = 9999;
const GRACE_NOTE_DURATION = 0.070;
const REGION_DIFF = 0.30;
const EPS = 1e-6;
const MAX_WIDTH_AMP = 4.0;
const MIN_WIDTH_AMP = 0.10;
const MAX_HEIGHT_AMP = 4.0;
const MIN_HEIGHT_AMP = 0.10;

let segmentOffset = 0;
let segmentSize = 30;

let backLayerObjects = [];
let middleLayerObjects = [];
let frontLayerObjects = [];

let widthAmp = 1.0; // 横の拡大倍率
let heightAmp = 1.0; // 縦の拡大倍率
let heightUnit = 10; // 五線譜の間隔
let amplifiedWidth = PX_PER_SEC * widthAmp;
let yOffsetFmt3x = 120; // 五線譜の Y 座標上端（fmt3x）
let yOffsetMatch = 340; // 五線譜の Y 座標上端（match）
let heightPerLine = 3 * yOffsetFmt3x + 20 * heightUnit; // widthLast にあたる const
let heightC4Fmt = 170; // C4 の位置(ト音記号の場合)
let heightC4Match = 390; // C4 の位置(ト音記号の場合)
let staffLineSpace = 20; // 五線譜の上段と下段の間隔
let maxTime = 2.1;
let windowWidth = X_OFFSET + maxTime * amplifiedWidth;
let fmtEventsArray = [];
let fmtCommentsArray = [];
let fmtVersion = "";
let fmtTPQN = 4;
let matchEventsArray = [];
let matchCommentsArray = [];
let missingNotesArray = [];
let errorRegionsArray = [];
let idToFmtPos = new Map();
let missingIDSet = new Set();
let showIDmode = 0;//0=hide, 1=show
let errOnOff = 0;//0=on, 1=off
let fontSize = 7;
let curFocusID;
let edits = [];
let regionIndex = 0;

let elDrop = document.getElementById('dropzone');

/**
 * fmt ファイルの読み込み
 * @param {File} file 読み込む fmt3x ファイル
 */
function readFmtFile(file){
	const TPQN = '//TPQN:';
	const VERSION = '//Fmt3xVersion:';
	const DUPLICATE = '//DuplicateOnsets:';
	const FMTVERSION = '170225';

	let reader = new FileReader();
	reader.readAsText(file);

	reader.onload = function(){
		fmtEventsArray = [];
		let fileContent = reader.result.split(/\n/);
		let len = fileContent.length;

		for(let i=0; i<len; i++){
			if(fileContent[i]==""){continue;}
			if(fileContent[i].match(TPQN)){// TPQN の読み込み
				let tpqnData = (fileContent[i].split(SPACE))[1];
				fmtTPQN = tpqnData;
			}else if(fileContent[i].match(VERSION)){// バージョン情報の読み込み
				let versionData = (fileContent[i].split(SPACE))[1];
				if(!versionData.match(FMTVERSION)){
					console.log("Warning: The fmt3x version is not " + FMTVERSION + ".");
				}//endif
				fmtVersion = versionData;
			}else if(fileContent[i].match(DUPLICATE)){// duplicate の情報
				console.log("Warning: DuplicateOnsets is NotImplemented.");
			}else if(fileContent[i][0] == "/" || fileContent[i][0] == "#"){// comment の読み込み
				let commentData = fileContent[i];
				fmtCommentsArray.push(commentData);
			}else{// 通常ノートの読み込み
				let fmtEvt=new Fmt3xEvent();
				fmtEvt.fromFileEvt(fileContent[i].split(/\s+/));
				fmtEventsArray.push(fmtEvt);
			}//endif
		}//endfor i
	}
	return;
}//end readFmtFile


/**
 * match ファイルの読み込み
 * @param {File} file 読み込む match ファイル
 */
function readMatchFile(file){
	const MISSING = 'Missing';

	let reader = new FileReader();
	reader.readAsText(file);

	reader.onload = function(){
		matchEventsArray = [];
		matchCommentsArray = [];
		missingNotesArray = [];
		let fileContent = reader.result.split(/\n/);

		for(let i=0, len=fileContent.length; i<len; i++){
			if(fileContent[i]==""){continue;}

			if (!fileContent[i].match(MISSING) && (fileContent[i][0] == '/' || fileContent[i][0] == '#')){// comment の読み込み
				let commentData = fileContent[i];
				matchCommentsArray.push(commentData);
			}else if(fileContent[i].match(MISSING)){// Missing Note の読み込み
				let missingEvt = new MissingNote();
				let events = fileContent[i].split(/\s+/);
				missingEvt.readFromFile(events);
				missingNotesArray.push(missingEvt);
			}else{// 通常ノートの読み込み
				let matchEvt = new ScorePerfmMatchEvt();
				matchEvt.fromFileEvt(fileContent[i].split(/\s+/));
				matchEventsArray.push(matchEvt);
			}//endif
		}//endfor i

		// maxTime の更新
		maxTime = 2.1;
		let lastIdx = matchEventsArray.length - 1;
		if (matchEventsArray[lastIdx].offtime + 3 > maxTime){
			maxTime = matchEventsArray[lastIdx].offtime + 3;
		}//endif

		// 五線譜への描画
		drawScore();
	}
	return;
}//end readMatchFile


/**
 * fmtEventsArray の中のfmt1IDを探す
 */
function FindFmt3xScorePos(Id_fmt1){
	let out=[-1,-1];//Found in evts[i].fmt1IDs[j] -> out[0]=i, out[1]=j, out[2,...]=corresponding pitches
	for(let i=0;i<fmtEventsArray.length;i+=1){
		for(let j=0;j<fmtEventsArray[i].fmt1IDs.length;j+=1){
			if(fmtEventsArray[i].fmt1IDs[j].indexOf(",")==-1){
				if(Id_fmt1==fmtEventsArray[i].fmt1IDs[j]){out[0]=i;out[1]=j;break;}
			}else{
				let tmp=fmtEventsArray[i].fmt1IDs[j].split(',');
				for(let k=0;k<tmp.length;k+=1){
					if(Id_fmt1==tmp[k]){out[0]=i;out[1]=j;break;}//endif
				}//endfor k
			}//endif
		}//endfor j
		if(out[0]>=0){break;}
	}//endfor i
	if(out[0]>=0){
		let tmp=fmtEventsArray[out[0]].sitches[out[1]].split(',');
		for(let k=0;k<tmp.length;k+=1){
			out.push(SitchToPitch(tmp[k]));
		}//endfor k
	}//endif
	return out;
}//end FindFmt3xScorePos


/**
 * 五線譜を描く
 * @param {*} mysvg HTML 内の mysvg
 */
function drawScoreBase(){
	const LINE_START_X = 0;
	let width = X_OFFSET + maxTime * amplifiedWidth;
	let ret = "";

	// 五線譜の描画部分
	// fmt3x 五段
	for(let i=-5; i<=5; i++){
		if(i==0){continue;}
		let line1=document.createElementNS('http://www.w3.org/2000/svg','line');
		line1.setAttribute('x1',LINE_START_X);
		line1.setAttribute('x2',width);
		line1.setAttribute('y1',heightC4Fmt+heightUnit*i);
		line1.setAttribute('y2',heightC4Fmt+heightUnit*i);
		line1.setAttribute('stroke-opacity',1);
		line1.setAttribute('stroke','rgba(0, 0, 0, 0.5)');
		line1.setAttribute('stroke-width',1);
		middleLayer.appendChild(line1);
	}//endfro i

	// match 五段
	for(let i=-5; i<=5; i++){
		if(i==0){continue;}
		let line1=document.createElementNS('http://www.w3.org/2000/svg','line');
		line1.setAttribute('x1',LINE_START_X);
		line1.setAttribute('x2',width);
		line1.setAttribute('y1',heightC4Match+heightUnit*i);
		line1.setAttribute('y2',heightC4Match+heightUnit*i);
		line1.setAttribute('stroke-opacity',1);
		line1.setAttribute('stroke','rgba(0, 0, 0, 0.5)');
		line1.setAttribute('stroke-width',1);
		middleLayer.appendChild(line1);
	}//endfor i

	// 小節線と小節番号の描画
	for(let t=0; t<maxTime; t++){
		let lineLeft = t * amplifiedWidth + X_OFFSET;
		let lineTopFmt = yOffsetFmt3x;
		let lineTopMatch = yOffsetMatch;
		let lineHeight = 10 * heightUnit;
		let line1=document.createElementNS('http://www.w3.org/2000/svg','line');
		line1.setAttribute('x1',lineLeft);
		line1.setAttribute('x2',lineLeft);
		line1.setAttribute('y1',lineTopFmt);
		line1.setAttribute('y2',lineTopFmt+lineHeight);
		line1.setAttribute('stroke-opacity',1);
		line1.setAttribute('stroke','rgba(62,20,168,0.4)');
		line1.setAttribute('stroke-width',1);
		middleLayer.appendChild(line1);
		ret += '<div style="position:absolute; left:'+(lineLeft - 3)+'px; top:'+(lineTopFmt - 15)+'px; width:0px; height:0px; color:rgba(62,20,168,0.4); font-size:10px;">'+t+'</div>';
		let line2=document.createElementNS('http://www.w3.org/2000/svg','line');
		line2.setAttribute('x1',lineLeft);
		line2.setAttribute('x2',lineLeft);
		line2.setAttribute('y1',lineTopMatch);
		line2.setAttribute('y2',lineTopMatch+lineHeight);
		line2.setAttribute('stroke-opacity',1);
		line2.setAttribute('stroke','rgba(62,20,168,0.4)');
		line2.setAttribute('stroke-width',1);
		middleLayer.appendChild(line2);
		ret += '<div style="position:absolute; left:'+(lineLeft - 3)+'px; top:'+(lineTopMatch - 15)+'px; width:0px; height:0px; color:rgba(62,20,168,0.4); font-size:10px;">'+t+'</div>';
	}//endfor t
	
	// ト音記号とヘ音記号の描画
	let gclefHeight = 7.5 * heightUnit;
	let fclefHeight = 3.4 * heightUnit;
	let gclefTopFmt = heightC4Fmt - 6.5 * heightUnit;
	let fclefTopFmt = heightC4Fmt + 0.9 * heightUnit;
	let gclefTopMatch = heightC4Match - 6.5 * heightUnit;
	let fclefTopMatch = heightC4Match + 0.9 * heightUnit;
	ret += '<img src="img/Gclef.png" height='+gclefHeight+' style="position:absolute; left:5px; top:'+gclefTopFmt+'px;"/>';
	ret += '<img src="img/Fclef.png" height='+fclefHeight+' style="position:absolute; left:8px; top:'+fclefTopFmt+'px;"/>';
	ret += '<img src="img/Gclef.png" height='+gclefHeight+' style="position:absolute; left:5px; top:'+gclefTopMatch+'px;"/>';
	ret += '<img src="img/Fclef.png" height='+fclefHeight+' style="position:absolute; left:8px; top:'+fclefTopMatch+'px;"/>';
	ret += '<div style="position:absolute; left:10px; top:'+(yOffsetFmt3x - 50*heightAmp)+'px; width:100px; height:0px; color:rgba(0,0,0,0.6); font-size:'+15*heightAmp+'px;">Score (fmt3x)</div>';
	ret += '<div style="position:absolute; left:10px; top:'+(yOffsetMatch - 50*heightAmp)+'px; width:100px; height:0px; color:rgba(0,0,0,0.6); font-size:'+15*heightAmp+'px;">Performance (match)</div>';

	return ret;
}


/**
 * 臨時記号を楽譜上に描画する
 * @param {Number} accidental 臨時記号に対応する値
 * @param {Number} leftPos 左端座標
 * @param {Number} topPos 上端座標
 */
function drawAccidentalMark(accidental, leftPos, topPos){
	let ret = "";
	if(accidental == 1){
		ret += '<img src="img/Sharp.png" height="'+(2 * heightUnit)+'" style="position:absolute; left:'+(leftPos - 8.5* heightAmp)+'px; top:'+(topPos - 0.5*heightUnit)+'px;"/>';
	}else if (accidental == 2){
		ret += '<img src="img/DoubleSharp.png" height="'+heightUnit+'" style="position:absolute; left:'+(leftPos - 12* heightAmp)+'px; top:'+(topPos)+'px;"/>';
	}else if (accidental == -1){
		ret += '<img src="img/Flat.png" height="'+(1.7 * heightUnit)+'" style="position:absolute; left:'+(leftPos - 9* heightAmp)+'px; top:'+(topPos - 0.7*heightUnit)+'px;"/>';
	}else if (accidental == -2){
		ret += '<img src="img/DoubleFlat.png" height="'+(1.7 * heightUnit)+'" style="position:absolute; left:'+(leftPos - 13.5* heightAmp)+'px; top:'+(topPos - 0.7*heightUnit)+'px;"/>';
	}//endif
	return ret;
}


/**
 * segmentID の配列を得る（fmt3x 描画の補助関数）
 */
function fmtGetSegmentIds(){
	const MATCH_EVENT_LENGTH = matchEventsArray.length;
	let ret = [];

	for(let i=0; i<=MATCH_EVENT_LENGTH; i++){
		if(i == 0 || i == MATCH_EVENT_LENGTH){
			ret.push(i);
			continue;
		}//endif

		let matchEvt = matchEventsArray[i];
		let skipInd = matchEvt.skipInd;

		if(skipInd !== "-" && skipInd !== "+"){
			ret.push(i);
		}//endif

		if(i % segmentSize == segmentOffset){
			for(let j=i; j<i+Math.floor(segmentSize/2) && j<MATCH_EVENT_LENGTH; j++){
				if(matchEventsArray[j].errorInd > 1){continue;}
				if(matchEventsArray[j].stime != matchEventsArray[j-1].stime && matchEventsArray[j].stime!=matchEventsArray[MATCH_EVENT_LENGTH-1].stime){
					ret.push(j);
					break;
				}//endif
			}//endfor j
		}//endif
	}//endfor i

	return ret;
}


/**
 * error indicator から error region を得る
 */
function fmtGetErrorRegions(){
	const MATCH_EVENT_LENGTH = matchEventsArray.length;
	let ret = [];

	for(let i=0; i<MATCH_EVENT_LENGTH; i++){
		let matchEvt = matchEventsArray[i];
		if(matchEvt.errorInd > 0){
			let t1 = matchEvt.ontime - REGION_DIFF;
			let t2 = matchEvt.ontime + REGION_DIFF;
			ret.push([t1, t2]);
		}//endif
	}//endfor i
	return ret;
}


/**
 * 装飾音符の Error region を得る
 * @param {*} drawedScores 
 * @param {*} minTRef 
 * @param {*} minSTime 
 * @param {*} tempo 
 */
function getFmtOrnamentedErrorRegions(drawedScores, minTRef, minSTime, tempo){
	let ret = [];
	for(let i=0; i<drawedScores.length; i++){
		let sEvt = drawedScores[i];
		let evtNoteTypeArray = sEvt.noteTypes;
		for(let j=0; j<sEvt.numNotes; j++){
			let evtNoteType = evtNoteTypeArray[j];
			let noteTypeSubstr = evtNoteType.substring(0, evtNoteType.indexOf('.'));
			if(noteTypeSubstr != "N"){
				let t = minTRef + (sEvt.stime - minSTime) * tempo + sEvt.subOrder * GRACE_NOTE_DURATION;
				let t1 =  t - REGION_DIFF;
				let t2 =  t + REGION_DIFF;
				ret.push([t1, t2]);
			}//endif
		}//endfor j
	}//endfor i

	return ret;
}


/**
 * missing note の error region を取得
 * @param {*} minTref 
 * @param {*} minSTime 
 * @param {*} tempo 
 */
function fmtMissingNoteErrorRegions(minTRef, minSTime, maxSTime, tempo){
	let ret = [];
	for(let i=0; i<missingNotesArray.length; i++){
		let missingEvt = missingNotesArray[i];
		let missingSTime = missingEvt.stime;
		if(minSTime <= missingSTime && missingSTime <= maxSTime){
			let t = minTRef + (missingSTime - minSTime) * tempo;
			let t1 = t - REGION_DIFF;
			let t2 = t + REGION_DIFF;
			ret.push([t1, t2]);
		}//endif
	}//endfor i
	return ret;
}


/**
 * error region の描画
 * @param {Array<Region>} regions : エラーリージョンの配列
 */
function drawErrorRegions(regions){
	for (let i=0;i<regions.length;i+=1){
		let t1 = regions[i][0];
		let t2 = regions[i][1];
		if(t1<-100 || t2<-100){continue;}
		let leftPos = X_OFFSET + amplifiedWidth * t1;
		let rightPos = X_OFFSET + amplifiedWidth * t2;
		let topPos = yOffsetFmt3x - 5 * staffLineSpace;
		let rectHeight = 25 * staffLineSpace;
		let rectWidth = rightPos - leftPos;
		let rect = document.createElementNS('http://www.w3.org/2000/svg','rect');
		rect.setAttribute('x', leftPos);
		rect.setAttribute('y', topPos);
		rect.setAttribute('width', rectWidth);
		rect.setAttribute('height', rectHeight);
		rect.setAttribute('fill','yellow');
		rect.setAttribute('fill-opacity','0.3');
		backLayer.appendChild(rect);
	}//endfor i
	return;
}


/**
 * fmt の minSTime 以上 maxStime 以下のスコアを得る
 * @param {Number} minSTime 
 * @param {Number} maxSTime 
 */
function getFmtSubScoreEvents(minSTime, maxSTime){
	let ret = [];
	for (let i = 0; i < fmtEventsArray.length; i++){
		let evt = fmtEventsArray[i];
		if (minSTime <= evt.stime && evt.stime <= maxSTime){ret.push(evt);}
	}//endfor i
	return ret;
}


/**
 * 加線の描画
 * @param {*} sitchHeight 
 * @param {*} leftPos 
 */
function drawFmtLedgerLine(sitchHeight, leftPos){
	let ret = "";
	if (sitchHeight == 0){
		let topPos = heightC4Fmt;
		let line = document.createElementNS('http://www.w3.org/2000/svg','line');
		line.setAttribute('x1', leftPos);
		line.setAttribute('x2', leftPos+16);
		line.setAttribute('y1', topPos);
		line.setAttribute('y2', topPos);
		line.setAttribute('stroke','rgba(0, 0, 0, 1)');
		line.setAttribute('stroke-width', 1);
		middleLayer.appendChild(line);
	}else if (sitchHeight > 11){
		for (let h = 12, end = sitchHeight; h <= end; h += 2){
			let topPos = heightC4Fmt - 0.5 * heightUnit * h;
			let line = document.createElementNS('http://www.w3.org/2000/svg','line');
			line.setAttribute('x1', leftPos);
			line.setAttribute('x2', leftPos+16);
			line.setAttribute('y1', topPos);
			line.setAttribute('y2', topPos);
			line.setAttribute('stroke','rgba(0, 0, 0, 1)');
			line.setAttribute('stroke-width', 1);
			middleLayer.appendChild(line);
		}//endfor h
	}else if (sitchHeight < -11){
		for (let h = -12, end = sitchHeight; h >= end; h -= 2){
			let topPos = heightC4Fmt - 0.5 * heightUnit * h;
			let line = document.createElementNS('http://www.w3.org/2000/svg','line');
			line.setAttribute('x1', leftPos);
			line.setAttribute('x2', leftPos+16);
			line.setAttribute('y1', topPos);
			line.setAttribute('y2', topPos);
			line.setAttribute('stroke','rgba(0, 0, 0, 1)');
			line.setAttribute('stroke-width', 1);
			middleLayer.appendChild(line);
		}//endfor h
	}//endif
	return ret;
}


/**
 * 楽譜表示用に ID を短縮する
 * @param {*} str : 元のID
 */
function simplifyFmt1ID(str){
	let ret = "";
	if (str[0] == "*" || str[0] == "&"){
		ret = str;
	}else if(str.substring(0, str.indexOf("-")) == "P1"){
		ret = str.substring(str.indexOf('-') + 1, str.length);
	}else{
		ret = str;
	}//endif
	return ret;
}


/**
 * 楽譜表示用ID を元に戻す
 */
function Completefmt1ID(str){
	if(str[0]=='*'){return "*";}
	if(str[0]=='&'){return "&";}
	if(str[0]=='P'){
		return str;
	}else{
		return "P1-"+str;
	}//endif
}


/**
 * 楽譜上に fmt のノートを描画する
 */
function setFmtNote(onLine, onPos, offPos, ditchHeight, accidental, yOffset, fmt1ID, isMissingNote){
	let ret = "";
	// 臨時線の描画
	ret += drawFmtLedgerLine(ditchHeight, onPos-8);
	// ノートの描画
	let noteTopPos = onLine * heightPerLine + yOffset + 5 * heightUnit - 0.5 * heightUnit * (ditchHeight + 1);
	let noteWidth = offPos - onPos + 1;
	// map に座標を入れておく (fmt1ID -> (onPos_x, onPos_y))
	let fmtPos = [onPos, noteTopPos + heightUnit];
	idToFmtPos.set(fmt1ID, fmtPos);
	let noteColor = accToColor(accidental,80);
	let simpleID = simplifyFmt1ID(fmt1ID);
	let rectFill = document.createElementNS('http://www.w3.org/2000/svg','rect');
	rectFill.setAttribute('x', onPos);
	rectFill.setAttribute('y', noteTopPos);
	rectFill.setAttribute('width', noteWidth);
	rectFill.setAttribute('height',heightUnit);
	rectFill.setAttribute('fill', noteColor);
	rectFill.setAttribute('stroke','none');
	frontLayer.appendChild(rectFill);
	let rectFrame = document.createElementNS('http://www.w3.org/2000/svg','rect');
	rectFrame.setAttribute('x', onPos);
	rectFrame.setAttribute('y', noteTopPos);
	rectFrame.setAttribute('width', noteWidth);
	rectFrame.setAttribute('height',heightUnit);
	rectFrame.setAttribute('fill', 'none');
	rectFrame.setAttribute('stroke',errToColor(isMissingNote ? -2 : 0));
	rectFrame.setAttribute('stroke-width', (isMissingNote)? 3:1);
	frontLayer.appendChild(rectFrame);

	if(showIDmode==1){
		ret += '<div id="fmt-'+fmt1ID+'" contentEditable=false style="position:absolute; left:'+(onPos+2)+'px; top:'+(noteTopPos)+'px; width:'+noteWidth+'px; height:'+(heightUnit-1)+'px; color:rgb(0,120,255); font-size:'+(fontSize*heightAmp)+'pt; white-space: nowrap;">'+simpleID+'</div>';
	}

	// 臨時記号
	let accidentalLeftPos = onPos;
	let accidentalTopPosBase = -(1 + ditchHeight) * 5*heightAmp + heightC4Fmt;
	ret += drawAccidentalMark(accidental, accidentalLeftPos, accidentalTopPosBase);
	return ret;
}


/**
 * matching line の描画
 */
function drawMatchLine(){
	for (let i = 0; i < matchEventsArray.length; i++){
		let matchEvt = matchEventsArray[i];
		let evtID = matchEvt.fmt1ID;
		let evtOnTime = matchEvt.ontime;
		let matchSitch = matchEvt.sitch;
		let sitchHeight = sitchToSitchHeight(matchSitch);
		let scoreNotePos;
		if (!idToFmtPos.has(evtID) || evtID.match("\\*") || evtID.match("\\&")){continue;}
		scoreNotePos = idToFmtPos.get(evtID);
		let fmtXPos = scoreNotePos[0];
		let fmtYPos = scoreNotePos[1];
		let matchXPos = X_OFFSET + amplifiedWidth * evtOnTime;
		let matchYPos = -(3 + sitchHeight) * 5 * heightAmp + heightC4Match + heightUnit;
		let horizontalLen = 0;
		let p1 = (fmtXPos + horizontalLen) + "," + fmtYPos;
		let p2 = fmtXPos + "," + fmtYPos;
		let p3 = matchXPos + "," + matchYPos;
		let p4 = (matchXPos + horizontalLen) + "," + matchYPos;
		let pStr = p1 + " " + p2 + " " + p3 + " " + p4;
		let matchLine = document.createElementNS('http://www.w3.org/2000/svg','polyline');
		matchLine.setAttribute('points', pStr);
		matchLine.setAttribute('fill', 'none');
		matchLine.setAttribute('stroke', 'rgb(16,115,108)');
		matchLine.setAttribute('stroke-width', LEGER_WIDTH);
		matchLine.setAttribute('id', 'matchline-' + evtID);
		frontLayer.appendChild(matchLine);
	}//endfor i
	return;
}


/**
 * fmt3x の楽譜のノートを描画する一連の手順からなる関数
 */
function drawFmtNote(){
	const STR_CHORD = 'chord';
	const STR_REST = 'rest';
	const STR_SHORT_APP = 'short-app';
	const STR_TREMOLO = 'tremolo';
	const STR_AFTERNOTE = 'after-note';

	// ret に描くオブジェクトのタグの文字列をどんどん突っ込んでいく
	let ret = '';
	let frontObjects = '';
	let endTime = -1000;
	let fmtEventSize = fmtEventsArray.length;
	let matchEventSize = matchEventsArray.length;

	// endtime の計算
	for (let i = 0; i < matchEventSize; i++){
		let matchOnTime = matchEventsArray[i].ontime;
		let matchOfftime = matchEventsArray[i].offtime;
		endTime = Math.max(endTime, matchOnTime, matchOfftime);
	}//endfor i

	// missing note の map 作成
	for (let i = 0; i < missingNotesArray.length; i++){
		let missingID = missingNotesArray[i].fmt1ID;
		missingIDSet.add(missingID);
	}//endfor i

	// perfmSegmentIds の取得
	let segmentIds = fmtGetSegmentIds();

	// errorRegion の取得 (overlap あり)
	let errorRegionsArrayTmp = fmtGetErrorRegions();

	// fmt セグメントごとの縮小率の計算
	// idToFmtPos は match の ID -> fmt ノートの座標をマッピングする
	let segmentIDSize = segmentIds.length;
	for(let i = 0; i < segmentIDSize - 1; i++){
		let maxSTime = -1;
		let minSTime = fmtEventsArray[fmtEventSize - 1].stime + 1;
		let maxTRef = matchEventsArray[0].ontime;
		let minTRef = matchEventsArray[matchEventSize - 1].ontime;

		for (let j = segmentIds[i]; j <= segmentIds[i+1] && j < matchEventSize; j++){
			let matchEvt = matchEventsArray[j];
			if (matchEvt.errorInd > 1){continue;}
			if (matchEvt.stime > maxSTime){
				maxSTime = matchEvt.stime;
				maxTRef = matchEvt.ontime;
			}//endif
			if (matchEvt.stime < minSTime){
				minSTime = matchEvt.stime;
				minTRef = matchEvt.ontime;
			}//endif
		}//endfor j

		// vref に対応
		let tempo = (maxTRef - minTRef) / (maxSTime - minSTime);
		if (maxSTime < matchEventsArray[matchEventSize - 1].stime){
			maxSTime--;
			maxTRef -= tempo;
		}

		// segment の情報から fmt の minSTime 以上 maxStime 以下のスコアを得る
		let drawedScores = getFmtSubScoreEvents(minSTime, maxSTime);

		// 装飾音符の error region を追加
		let ornamentErrorRegions = getFmtOrnamentedErrorRegions(drawedScores, minTRef, minSTime, tempo);
		errorRegionsArrayTmp = errorRegionsArrayTmp.concat(ornamentErrorRegions);

		// missing note の error region を追加
		let missingNoteErrorRegions = fmtMissingNoteErrorRegions(minTRef, minSTime, maxSTime, tempo);
		errorRegionsArrayTmp = errorRegionsArrayTmp.concat(missingNoteErrorRegions);

		for (let j = 0; j < drawedScores.length; j++){
			let drawedFmtEvt = drawedScores[j];
			let eventType = drawedFmtEvt.eventType;
			let numNotes = drawedFmtEvt.numNotes;
			let fmtSitchArray = drawedFmtEvt.sitches;
			let fmtSTime = drawedFmtEvt.stime;
			let fmtSubOrder = drawedFmtEvt.subOrder;
			let fmtDur = drawedFmtEvt.duration;
			let fmt1IDArray = drawedFmtEvt.fmt1IDs;

			// eventType ごとに処理
			if (eventType.match(STR_REST) || eventType.match(STR_TREMOLO)){// rest : 休符// tremolo : トレモロ

				continue;

			}else if (eventType.match(STR_CHORD)){// chord : 通常の音符の場合

				for (let k = 0; k < numNotes; k++){
					// ノート情報取得
					let fmtSitch = fmtSitchArray[k];
					let fmt1ID = fmt1IDArray[k];

					// initialize
					let isOrnament = false;
					let principleDitch = "";
					let auxiliaryDitch = ""; // ???
					let ornamentInd = ""; // ???

					
					if (fmtSitch.match(',')){// if ornamented
						isOrnament = true;
						principleDitch = fmtSitch.substring(0, fmtSitch.indexOf(','));
						ornamentInd=drawedScores[j].noteTypes[k].slice(0,drawedScores[j].noteTypes[k].indexOf('.'))+'('+fmtSitch+')';
					}else{// not ornamented
						principleDitch = fmtSitch;
					}//endif

					// 音名から楽譜上での位置、臨時記号フラグ抽出
					let ditchHeight = sitchToSitchHeight(principleDitch);
					let acc = sitchToAcc(principleDitch);
					// position の計算
					let onPos = X_OFFSET + amplifiedWidth *
								(minTRef + (fmtSTime - minSTime) * tempo + fmtSubOrder * GRACE_NOTE_DURATION);
					let offPos = X_OFFSET + amplifiedWidth *
								(minTRef + (fmtSTime + fmtDur - minSTime) * tempo);
					// missing かどうかのチェック
					let isMissingNote = missingIDSet.has(fmt1ID);

					// 描画
					frontObjects += setFmtNote(0, onPos, offPos, ditchHeight, acc, yOffsetFmt3x, fmt1ID, isMissingNote);
					if(ornamentInd!=''){
						frontObjects+='<div contentEditable=false style="position:absolute; left:'+(onPos)+'px; top:'+(yOffsetFmt3x + 5*heightUnit - 0.5*heightUnit*(ditchHeight+1)-2*heightUnit)+'px; width:10px; height:'+(heightUnit-1)+'px; color:rgb(0,0,0); font-size:'+(fontSize*heightAmp)+'pt; white-space: nowrap;">'+ornamentInd+'</div>';
					}//endif
				}//endfor k

			}else if(eventType.match(STR_SHORT_APP) || eventType.match(STR_AFTERNOTE)){// short-apps or after-note

				for (let k = 0; k < numNotes; k++){
					// ノート情報取得
					let fmt1ID = fmt1IDArray[k];
					let principleDitch = fmtSitchArray[k];
					// 音名から楽譜上での位置、臨時記号フラグ抽出
					let ditchHeight = sitchToSitchHeight(principleDitch);
					let acc = sitchToAcc(principleDitch);
					// position の計算
					let onPos = X_OFFSET + amplifiedWidth *
								(minTRef + (fmtSTime - minSTime) * tempo + fmtSubOrder * GRACE_NOTE_DURATION);
					let offPos = onPos + amplifiedWidth * GRACE_NOTE_DURATION;
					// missing かどうかのチェック
					let isMissingNote = missingIDSet.has(fmt1ID);
					// 描画
					frontObjects += setFmtNote(0, onPos, offPos, ditchHeight, acc, yOffsetFmt3x, fmt1ID, isMissingNote);
				}//endfor k

			}//endif

		}//endfor j
	}//endfor i

	// matching line の描画
	drawMatchLine();

	// error region 関連
	let errorRegions = new Region(errorRegionsArrayTmp);
	errorRegions.removeOverlappingRegion();
	if(errOnOff==0){
		drawErrorRegions(errorRegions.regions);
	}//endif
	errorRegionsArray = errorRegions.regions;

	ret = frontObjects;
	return ret;
}


/**
 * match の加線の描画
 * @param {*} sitchHeight 
 * @param {*} leftPos 
 */
function drawMatchLedgerLine(sitchHeight, leftPos){
	if (sitchHeight == 0){
		let topPos = heightC4Match;
		let line = document.createElementNS('http://www.w3.org/2000/svg','line');
		line.setAttribute('x1', leftPos);
		line.setAttribute('x2', leftPos + 16);
		line.setAttribute('y1', topPos);
		line.setAttribute('y2', topPos);
		line.setAttribute('stroke','rgba(0, 0, 0, 1)');
		line.setAttribute('stroke-width', 1);
		middleLayer.appendChild(line);
	}else if (sitchHeight > 11){
		for (let h=12, end=sitchHeight;h<=end; h+=2){
			let topPos = heightC4Match - 0.5 * heightUnit * h;
			let line = document.createElementNS('http://www.w3.org/2000/svg','line');
			line.setAttribute('x1', leftPos);
			line.setAttribute('x2', leftPos + 16);
			line.setAttribute('y1', topPos);
			line.setAttribute('y2', topPos);
			line.setAttribute('stroke','rgba(0, 0, 0, 1)');
			line.setAttribute('stroke-width', 1);
			middleLayer.appendChild(line);
		}//endfor h
	}else if (sitchHeight < -11){
		for (let h=-12, end=sitchHeight; h>=end; h-=2){
			let topPos = heightC4Match - 0.5 * heightUnit * h;
			let line = document.createElementNS('http://www.w3.org/2000/svg','line');
			line.setAttribute('x1', leftPos);
			line.setAttribute('x2', leftPos + 16);
			line.setAttribute('y1', topPos);
			line.setAttribute('y2', topPos);
			line.setAttribute('stroke','rgba(0, 0, 0, 1)');
			line.setAttribute('stroke-width', 1);
			middleLayer.appendChild(line);
		}//endfor h
	}//endif
	return;
}


/**
 * match 系の情報を楽譜上に描く
 */
function drawMatchNote(){
	let ret = "";
	for (let i=0; i<matchEventsArray.length; i++){
		let matchEvent = matchEventsArray[i];
		let matchSitch = matchEvent.sitch;
		let matchOntime = matchEvent.ontime;
		let matchOfftime = matchEvent.offtime;
		let matchOnvel = matchEvent.onvel;
		let matchFmt1ID = matchEvent.fmt1ID;
		let matchErrorInd = matchEvent.errorInd;
		let sitchHeight = sitchToSitchHeight(matchSitch);
		let leftPos = matchOntime * amplifiedWidth + X_OFFSET - 8;
		
		// 加線描画
		drawMatchLedgerLine(sitchHeight, leftPos);

		// ノートの描画
		let accidental = sitchToAcc(matchSitch);
		let noteLeftPos = matchOntime * amplifiedWidth + X_OFFSET;
		let noteTopPos = -(1 + sitchHeight) * 5 * heightAmp + heightC4Match;
		let noteWidth = (matchOfftime - matchOntime) * amplifiedWidth;
		let noteColor = accToColor(accidental,matchOnvel);
		let simpleID = simplifyFmt1ID(matchFmt1ID);
		matchEvent.rep=simpleID;
		matchEvent.orgRep=simpleID;

		let rectFill = document.createElementNS('http://www.w3.org/2000/svg','rect');
		rectFill.setAttribute('x', noteLeftPos);
		rectFill.setAttribute('y', noteTopPos);
		rectFill.setAttribute('width', noteWidth);
		rectFill.setAttribute('height',heightUnit);
		rectFill.setAttribute('fill', noteColor);
		rectFill.setAttribute('stroke','none');
		frontLayer.appendChild(rectFill);
		let rectFrame = document.createElementNS('http://www.w3.org/2000/svg','rect');
		rectFrame.setAttribute('x', noteLeftPos);
		rectFrame.setAttribute('y', noteTopPos);
		rectFrame.setAttribute('width', noteWidth);
		rectFrame.setAttribute('height',heightUnit);
		rectFrame.setAttribute('fill', 'none');
		rectFrame.setAttribute('stroke',errToColor(matchErrorInd));
		rectFrame.setAttribute('stroke-width', (matchErrorInd>0)? 3:1);
		frontLayer.appendChild(rectFrame);

		if(showIDmode==1){
			let fontColor = simpleID === '*' ? 'rgb(255,30,120)' : 'rgb(0,120,255)';
			ret += '<div id="match-'+i+'" contentEditable=true style="position:absolute; left:'+(noteLeftPos+2)+'px; top:'+(noteTopPos)+'px; width:'+noteWidth+'px; height:'+(heightUnit-1)+'px; color:'+fontColor+'; font-size:'+(fontSize*heightAmp)+'pt; white-space: nowrap;">'+simpleID+'</div>';
		}

		// 臨時記号の描画
		let accidentalLeftPos = matchOntime * amplifiedWidth + X_OFFSET;
		let accidentalTopPosBase = -(1 + sitchHeight) * 5 * heightAmp + heightC4Match;
		ret += drawAccidentalMark(accidental, accidentalLeftPos, accidentalTopPosBase);
	}

	return ret;
}


/**
 * 楽譜への描画を行う一連の動作からなるメソッド
 */
function drawScore(){
	document.getElementById('display').style.width = (window.innerWidth - 50) + 'px';
	document.getElementById('display').style.height = String(200 + yOffsetMatch) + 'px';
	windowWidth = X_OFFSET + maxTime * amplifiedWidth;
	windowHeight = yOffsetMatch + 19 * heightUnit;
	backLayerObjects = [];
	middleLayerObjects = [];
	frontLayerObjects = [];
	errorRegionsArray = [];

	document.getElementById('display').innerHTML = '<svg id="scoreDisplay" xmlns="http://www.w3.org/2000/svg" width='+(windowWidth+100)+' height='+windowHeight+'><g id="backLayer"></g><g id="middleLayer"></g><g id="frontLayer"></g></svg>';
	let str = "";

	// 五線譜
	let lineStr = drawScoreBase();
	str += lineStr;

	// マップの初期化
	idToFmtPos.clear();
	missingIDSet.clear();

	// match 系の描画
	if (matchEventsArray.length > 0){
		let matchStr = drawMatchNote();
		// fmt 系の描画
		if (fmtEventsArray.length > 0){
			let fmtStr = drawFmtNote();
			str += fmtStr;
		}//endif
		str += matchStr;
	}//endif

	// div 要素の描画
	document.getElementById('display').innerHTML+= str;

	$(function(){
		$('#display > *').keyup(function(){
			let selectedPos = this;
			if(selectedPos.id.indexOf('match')==-1){
				return;
			}//endif
			let matchNoteID=parseInt(selectedPos.id.slice(6),10);

			if(showIDmode==1){

				if(selectedPos.innerHTML!=matchEventsArray[matchNoteID].rep){
					matchEventsArray[matchNoteID].rep=selectedPos.innerHTML;
					if(edits.length>0){
						edits.push([matchNoteID,selectedPos.innerHTML]);
						if(edits[edits.length-1][0]==matchNoteID){
							edits[edits.length-1][1]=selectedPos.innerHTML;
						}else{
							edits.push([matchNoteID,selectedPos.innerHTML]);
						}//endif
					}else{
						edits.push([matchNoteID,selectedPos.innerHTML]);
					}//endif
					UpdateEditInfo();
				}//endif

			}//endif

			if(curFocusID==selectedPos.id){
				return;
			}else{
				$("#focusline").remove();
				$("#focusline2").remove();
				curFocusID=selectedPos.id;
			}//endif
			SetFocusline(matchNoteID);
// console.log("keyup");
		});

		$('#display > *').click(function(){
			let selectedPos = this;
			if(selectedPos.id.indexOf('match')==-1){
				$("#focusline").remove();
				$("#focusline2").remove();
				return;
			}//endif
			$("#focusline").remove();
			$("#focusline2").remove();
			if(curFocusID==selectedPos.id){
				curFocusID='';
				return;
			}else{
				curFocusID=selectedPos.id;
			}//endif
			let matchNoteID=parseInt(curFocusID.slice(6),10);
			SetFocusline(matchNoteID);
// console.log("click");
		});

	});

	return;
}


function SetFocusline(matchNoteID){
	let noteLeftPos = matchEventsArray[matchNoteID].ontime * amplifiedWidth + X_OFFSET;
	let noteTopPos = -(1 + sitchToSitchHeight(matchEventsArray[matchNoteID].sitch)) * 5 * heightAmp + heightC4Match;

	let evtID = matchEventsArray[matchNoteID].fmt1ID;
	if (!idToFmtPos.has(evtID) || evtID.match("\\*") || evtID.match("\\&")){
		return;
	}//endif
	let scoreNotePos = idToFmtPos.get(evtID);
	let fmtXPos = scoreNotePos[0];
	let fmtYPos = scoreNotePos[1];

	let line = document.createElementNS('http://www.w3.org/2000/svg','line');
	line.setAttribute('x1', noteLeftPos);
	line.setAttribute('x2', fmtXPos);
	line.setAttribute('y1', noteTopPos);
	line.setAttribute('y2', fmtYPos);
	line.setAttribute('stroke','rgba(0, 120, 255, 1)');
	line.setAttribute('stroke-width', 10);
	line.setAttribute('id','focusline');
	frontLayer.appendChild(line);
	let line2 = document.createElementNS('http://www.w3.org/2000/svg','line');
	line2.setAttribute('x1', noteLeftPos);
	line2.setAttribute('x2', fmtXPos);
	line2.setAttribute('y1', noteTopPos);
	line2.setAttribute('y2', fmtYPos);
	line2.setAttribute('stroke','rgba(0, 0, 0, 1)');
	line2.setAttribute('stroke-width', 2);
	line2.setAttribute('id','focusline2');
	frontLayer.appendChild(line2);
}//


/**
 * 倍率変更後などのオフセットの値をセットする
 */
function setOffsetValue(){
	amplifiedWidth = PX_PER_SEC * widthAmp;
	heightUnit = 10 * heightAmp;
	yOffsetFmt3x = 120 * heightAmp; // 五線譜の Y 座標上端（fmt3x） 
	yOffsetMatch = yOffsetFmt3x + 22*heightUnit; // 五線譜の Y 座標上端（match）
	heightPerLine = 3 * yOffsetFmt3x + 20 * heightUnit; // widthLast にあたる const
	heightC4Fmt = yOffsetFmt3x + 5 * heightUnit; // C4 の位置(ト音記号の場合)
	heightC4Match = yOffsetMatch + 5 * heightUnit; // C4 の位置(ト音記号の場合)
	staffLineSpace = 2 * heightUnit; // 五線譜の上段と下段の間隔
	return;
}


/**
 * 倍率のパーセント表示部分の値の変更
 */
function showAmp(){
	let widthPercentage = Math.floor(widthAmp * 100);
	let heightPercentage = Math.floor(heightAmp * 100);
	$("#displayAmp").text("Width " + widthPercentage + " % 　 Height " + heightPercentage + " %");
	document.getElementById('widthInput').value = widthPercentage;
	document.getElementById('heightInput').value = heightPercentage;
	return;
}

/**
 * fmt3x ファイル読み込み
 */
$("#filein1").change(function(event){
	let txtFile = event.target.files[0];
	let fileName = txtFile.name;
	widthAmp = 1.0;
	heightAmp = 1.0;
	showAmp();
	setOffsetValue();
	readFmtFile(txtFile);
	document.getElementById('filename1').value = fileName;
});


/**
 * match ファイルの読み込みボックスからの処理
 */
$("#filein2").change(function(event){
	let txtFile = event.target.files[0];
	let fileName = txtFile.name;
	widthAmp = 1.0;
	heightAmp = 1.0;
	showAmp();
	setOffsetValue();
	readMatchFile(txtFile);
	document.getElementById('filename2').value = fileName;
});


elDrop.addEventListener('dragover', function(event) {
	event.preventDefault();
	event.dataTransfer.dropEffect = 'copy';
	elDrop.classList.add('dropover');
});


elDrop.addEventListener('dragleave', function(event) {
	elDrop.classList.remove('dropover');
});


elDrop.addEventListener('drop', function(event) {
	event.preventDefault();
	elDrop.classList.remove('dropover');
	widthAmp = 1.0;
	heightAmp = 1.0;
	showAmp();
	setOffsetValue();
	let txtFiles = event.dataTransfer.files;

	for(let i=0, end=txtFiles.length;i<end;i+=1){
		if(txtFiles[i].name.indexOf('fmt3x')!=-1){
			readFmtFile(txtFiles[i]);
			$("#filename1").text(txtFiles[i].name);
			break;
		}//endif
		txtFiles[i];
	}//endfor i

	for(let i=0, end=txtFiles.length;i<end;i+=1){
		if(txtFiles[i].name.indexOf('match')!=-1){
			readMatchFile(txtFiles[i]);
			$("#filename2").text(txtFiles[i].name);
			break;
		}//endif
		txtFiles[i];
	}//endfor i
});


/**
 * 横幅縮小ボタンが押されたときの処理
 */
document.getElementById('shrinkButton').addEventListener('click', function(){
	let diff = (widthAmp > MIN_WIDTH_AMP + EPS) ? 0.1 : 0;
	widthAmp -= diff;
	showAmp();
	setOffsetValue();
	drawScore();
	let pos = (widthAmp/(widthAmp+diff))*(document.getElementById('display').scrollLeft - X_POS_CORRECTION) + X_POS_CORRECTION;
	document.getElementById('display').scrollLeft = pos;
});


/**
 * 横幅拡大ボタンが押されたときの処理
 */
document.getElementById('enlargeButton').addEventListener('click', function(){
	let diff = (widthAmp < MAX_WIDTH_AMP - EPS) ? 0.1 : 0;
	widthAmp += diff;
	showAmp();
	setOffsetValue();
	drawScore();
	let pos = (widthAmp/(widthAmp-diff)) * (document.getElementById('display').scrollLeft - X_POS_CORRECTION) + X_POS_CORRECTION;
	document.getElementById('display').scrollLeft = pos;
});


/**
 * 縮小ボタンが押されたときの処理
 */
document.getElementById('minusButton').addEventListener('click', function(){
	let diff = (widthAmp > MIN_WIDTH_AMP + EPS) ? 0.1 : 0;
	widthAmp -= diff;
	let diff_height = (heightAmp > MIN_HEIGHT_AMP + EPS) ? 0.1 : 0;
	heightAmp -= diff_height;
	showAmp();
	setOffsetValue();
	drawScore();
	let pos = (widthAmp/(widthAmp+diff))*(document.getElementById('display').scrollLeft - X_POS_CORRECTION) + X_POS_CORRECTION;
	document.getElementById('display').scrollLeft = pos;
});


/**
 * 拡大ボタンが押されたときの処理
 */
document.getElementById('plusButton').addEventListener('click', function(){
	let diff = (widthAmp < MAX_WIDTH_AMP - EPS) ? 0.1 : 0;
	widthAmp += diff;
	let diff_height = (heightAmp < MAX_HEIGHT_AMP - EPS) ? 0.1 : 0;
	heightAmp += diff_height;
	showAmp();
	setOffsetValue();
	drawScore();
	let pos = (widthAmp/(widthAmp-diff))* (document.getElementById('display').scrollLeft - X_POS_CORRECTION) + X_POS_CORRECTION;
	document.getElementById('display').scrollLeft = pos;
});


/**
 * msec だけ sleep するタイマー（error region フォーカス用）
 * @param {*} msec 
 */
function sleep(msec) {
	return new Promise(function(resolve) {
		setTimeout(function() {resolve()}, msec);
	})
}


/**
 * 移動後の Region フォーカスを表示
 */
async function focusRegion(x, y, w, h){
	let rect = document.createElementNS('http://www.w3.org/2000/svg','rect');
	rect.setAttribute('x', x);
	rect.setAttribute('y', y);
	rect.setAttribute('width', w);
	rect.setAttribute('height', h);
	rect.setAttribute('stroke','rgba(200, 80, 0, 1)');
	rect.setAttribute('stroke-width', 2);
	rect.setAttribute('fill', 'rgba(255, 128, 0, 0.5)');
	rect.setAttribute('id','focusRect');
	frontLayer.appendChild(rect);
	await sleep(300);
	$("#focusRect").remove();
	return;
}


/**
 * prev ボタンが押されたときの処理
 */
document.getElementById('prevButton').addEventListener('click', function(){
	let endPos = X_OFFSET + maxTime * amplifiedWidth;
	let windowWidthStr = document.getElementById('display').style.width;
	let windowWidthSize = 0;
	let currentRegionIndex = regionIndex;

	// window width の取得（px という単位がついているので数値だけ取り出す）
	for(let i = 0; i < windowWidthStr.length; i++){
		if(0 <= windowWidthStr[i] - '0' && windowWidthStr[i] - '0' <= 9){
			windowWidthSize = 10 * windowWidthSize + Number(windowWidthStr[i] - '0');
		}else{
			break;
		}//endif
	}//endfor i

	if (endPos <= windowWidthSize){return;}

	const WINDOW_CENTER = windowWidthSize / 2;
	let currentPos = document.getElementById('display').scrollLeft + WINDOW_CENTER;
	let prevPos = -1000;

	// prev となるエラーリージョン検索
	if (document.getElementById('display').scrollLeft > 0){
		for (let i = 0; i < errorRegionsArray.length; i++){
			let t1Pos = X_OFFSET + amplifiedWidth * errorRegionsArray[i][0];
			let t2Pos = X_OFFSET + amplifiedWidth * errorRegionsArray[i][1];
			let regionCenterPos = (t1Pos + t2Pos) / 2;
			if (regionCenterPos < currentPos){
				prevPos = regionCenterPos - WINDOW_CENTER;
				regionIndex = i;
			}//endif
		}//endfor i
		if (regionIndex == currentRegionIndex){
			regionIndex = (regionIndex - 1 >= 0) ? (regionIndex - 1) : errorRegionsArray.length - 1;
			let t1Pos = X_OFFSET + amplifiedWidth * errorRegionsArray[i][0];
			let t2Pos = X_OFFSET + amplifiedWidth * errorRegionsArray[i][1];
			let regionCenterPos = (t1Pos + t2Pos) / 2;
			prevPos = regionCenterPos - WINDOW_CENTER;
		}//endif
	}else{
		regionIndex = (regionIndex - 1 >= 0) ? (regionIndex - 1) : errorRegionsArray.length - 1;
		let t1Pos = X_OFFSET + amplifiedWidth * errorRegionsArray[regionIndex][0];
		let t2Pos = X_OFFSET + amplifiedWidth * errorRegionsArray[regionIndex][1];
		prevPos = (t1Pos + t2Pos) / 2 - WINDOW_CENTER;
	}//endif

	console.log("region index " + regionIndex);

	let t1 = X_OFFSET + amplifiedWidth * errorRegionsArray[regionIndex][0];
	let t2 = X_OFFSET + amplifiedWidth * errorRegionsArray[regionIndex][1];
	let w = t2 - t1;
	let h = 25 * staffLineSpace;
	let topPos = yOffsetFmt3x - 5 * staffLineSpace;
	focusRegion(t1, topPos, w, h);

	document.getElementById('display').scrollLeft = prevPos;
});


/**
 * next ボタンが押されたときの処理
 */
document.getElementById('nextButton').addEventListener('click', function(){
	let endPos = X_OFFSET + maxTime * amplifiedWidth;
	let windowWidthStr = document.getElementById('display').style.width;
	let windowWidthSize = 0;
	let currentRegionIndex = regionIndex;
//	console.log("aaa" + document.getElementById('display').scrollLeft);

	// window width の取得（px という単位がついているので数値だけ取り出す）
	for(let i = 0; i < windowWidthStr.length; i++){
		if(0 <= windowWidthStr[i] - '0' && windowWidthStr[i] - '0' <= 9){
			windowWidthSize = 10 * windowWidthSize + Number(windowWidthStr[i] - '0');
		}else{
			break;
		}//endif
	}//endfor i

	if (endPos <= windowWidthSize){return;}

	const WINDOW_CENTER = windowWidthSize / 2;
	let currentPos = document.getElementById('display').scrollLeft + WINDOW_CENTER + 1;
	let nextPos = -1000;

	// next となるエラーリージョン検索
	if (document.getElementById('display').scrollLeft > 0){
		for(let i = errorRegionsArray.length - 1; i >= 0; i--){
			let t1Pos = X_OFFSET + amplifiedWidth * errorRegionsArray[i][0];
			let t2Pos = X_OFFSET + amplifiedWidth * errorRegionsArray[i][1];
			let regionCenterPos = (t1Pos + t2Pos) / 2;
			if(currentPos < regionCenterPos){
				nextPos = regionCenterPos - WINDOW_CENTER;
				regionIndex = i;
			}//endif
		}//endfor i
	}else{
		regionIndex = (regionIndex + 1 < errorRegionsArray.length) ? (regionIndex + 1) : 0;
		let t1Pos = X_OFFSET + amplifiedWidth * errorRegionsArray[regionIndex][0];
		let t2Pos = X_OFFSET + amplifiedWidth * errorRegionsArray[regionIndex][1];
		nextPos = (t1Pos + t2Pos) / 2 - WINDOW_CENTER;
	}//endif

	if (regionIndex == currentRegionIndex){
		regionIndex = (regionIndex + 1 < errorRegionsArray.length) ? (regionIndex + 1) : 0;
		let t1Pos = X_OFFSET + amplifiedWidth * errorRegionsArray[regionIndex][0];
		let t2Pos = X_OFFSET + amplifiedWidth * errorRegionsArray[regionIndex][1];
		let regionCenterPos = (t1Pos + t2Pos) / 2;
		nextPos = regionCenterPos - WINDOW_CENTER;
	}//endif

	let t1 = X_OFFSET + amplifiedWidth * errorRegionsArray[regionIndex][0];
	let t2 = X_OFFSET + amplifiedWidth * errorRegionsArray[regionIndex][1];
	let w = t2 - t1;
	let h = 25 * staffLineSpace;
	let topPos = yOffsetFmt3x - 5 * staffLineSpace;
	focusRegion(t1, topPos, w, h);

	document.getElementById('display').scrollLeft = nextPos;
});


function clearScore(){
	fmtEventsArray = [];
	matchEventsArray = [];
	widthAmp=1;
	heightAmp=1;
	fontSize=7;
	document.getElementById('moveToSec').value=0;
	showAmp();
	setOffsetValue();
	maxTime = 2.1;
	segmentOffset=0;
	segmentSize=30;
	document.getElementById('segStatus').innerHTML='('+segmentOffset+','+segmentSize+')';
	init();
}


document.getElementById('clearButton').addEventListener('click', function(){
	clearScore();
});


document.getElementById('drawButton').addEventListener('click', function(event){
// let segmentOffset = 0;
// let segmentSize = 30;
	if(edits.length==0){
		if(segmentOffset==0&&segmentSize==30){
			segmentOffset=15;//15
			segmentSize=30;//30
		}else if(segmentOffset==15&&segmentSize==30){
			segmentOffset=15;
			segmentSize=100;
		}else if(segmentOffset==15&&segmentSize==100){
			segmentOffset=65;
			segmentSize=100;
		}else if(segmentOffset==65&&segmentSize==100){
			segmentOffset=0;
			segmentSize=100000;
		}else if(segmentOffset==0&&segmentSize==100000){
			segmentOffset=0;
			segmentSize=30;
		}else{
			segmentOffset=0;
			segmentSize=30;
		}//endif
		document.getElementById('segStatus').innerHTML='('+segmentOffset+','+segmentSize+')';
	}//endif

	widthAmp = document.getElementById('widthInput').value/100.;
	heightAmp = document.getElementById('heightInput').value/100.;
	fontSize=document.getElementById('fontSizeInput').value;
	showAmp();
	setOffsetValue();
	UpdateMatchData();
	document.getElementById('correctInfo').value="";
	drawScore();
	let pos = document.getElementById('moveToSec').value*amplifiedWidth + X_POS_CORRECTION;
	document.getElementById('display').scrollLeft = pos;
});


document.getElementById('display').onscroll = function() {
	document.getElementById('moveToSec').value=(this.scrollLeft - X_POS_CORRECTION)/amplifiedWidth;
}


document.getElementById('showIDButton').addEventListener('click', function(event){
	if(document.getElementById('showIDButton').value=='Show ID'){
		showIDmode=1;
		drawScore();
		document.getElementById('showIDButton').value='Hide ID';
	}else{
		showIDmode=0;
		drawScore();
		document.getElementById('showIDButton').value='Show ID';
	}//endif
});


document.getElementById('errOnOffButton').addEventListener('click', function(event){
	if(errOnOff==0){
		errOnOff=1;
		drawScore();
	}else{
		errOnOff=0;
		drawScore();
	}//endif
});


function UpdateEditInfo(){
	str='';
	for(let i=edits.length-2;i>=0;i-=1){
		if(edits[i][0]==edits[i+1][0]){edits.splice(i,1);
		}else{break;
		}//endif
	}//endfor i
	for(let i=edits.length-1;i>=0;i-=1){
		str+=edits[i][0]+': '+matchEventsArray[edits[i][0]].orgRep+' -> '+edits[i][1]+'\n';
	}//endfor i
	document.getElementById('correctInfo').value=str;
}//end UpdateEditInfo


function UpdateMatchData(){
	let replacedFmt1IDs=[];//To be candidates of missing notes

	for(let i=0;i<edits.length;i+=1){

		if(edits[i][1].length==0){//Typo
		//Do nothing (retain the original information)

//		}else if(edits[i][1][0]=='&'){//Extra note (note-wise)
// 			if(scorePerfmMatch.evts[n].fmt1ID!="&"&&scorePerfmMatch.evts[n].fmt1ID!="*"){
// 				replacedFmt1IDs.push_back(scorePerfmMatch.evts[n].fmt1ID);
// 			}//endif
// 			scorePerfmMatch.evts[n].fmt1ID="&";
// 			scorePerfmMatch.evts[n].errorInd=2;
// 			scorePerfmMatch.evts[n].matchStatus=-1;

		}else if(edits[i][1][0]=='&' || edits[i][1][0]=='*'){//Extra note (cluster-wise)

			if(matchEventsArray[edits[i][0]].fmt1ID!="&" && matchEventsArray[edits[i][0]].fmt1ID!="*"){
				replacedFmt1IDs.push(matchEventsArray[edits[i][0]].fmt1ID);
			}//endif

			matchEventsArray[edits[i][0]].matchStatus=-1;
			matchEventsArray[edits[i][0]].stime=-1;
			matchEventsArray[edits[i][0]].fmt1ID="*";
			matchEventsArray[edits[i][0]].errorInd=3;
			matchEventsArray[edits[i][0]].rep="";
			matchEventsArray[edits[i][0]].orgRep="";

		}else{//With fmt1ID -> correct note or pitch error

			matchEventsArray[edits[i][0]].matchStatus=0;
			newFmt1ID=Completefmt1ID(edits[i][1]);
			if(newFmt1ID==matchEventsArray[edits[i][0]].fmt1ID){//Not changed -> Do nothing
			}else{
				if(matchEventsArray[edits[i][0]].fmt1ID!="&" && matchEventsArray[edits[i][0]].fmt1ID!="*"){
					replacedFmt1IDs.push(matchEventsArray[edits[i][0]].fmt1ID);
				}//endif

				let scorePos=FindFmt3xScorePos(newFmt1ID);
				if(scorePos[0]>=0){
					matchEventsArray[edits[i][0]].stime=fmtEventsArray[scorePos[0]].stime;
					let pos=-1;
					for(let k=2;k<scorePos.length;k+=1){
						if(scorePos[k]==SitchToPitch(matchEventsArray[edits[i][0]].sitch)){pos=k;break;}//endif
					}//endfor k
					if(pos>0){
						matchEventsArray[edits[i][0]].errorInd=0;
					}else{
						matchEventsArray[edits[i][0]].errorInd=1;
					}//endif
					matchEventsArray[edits[i][0]].fmt1ID=newFmt1ID;
				}else{//This is unexpected
					matchEventsArray[edits[i][0]].stime=-1;
					matchEventsArray[edits[i][0]].fmt1ID="*";
					matchEventsArray[edits[i][0]].errorInd=3;
					matchEventsArray[edits[i][0]].matchStatus=-1;
					matchEventsArray[edits[i][0]].rep="";
					matchEventsArray[edits[i][0]].orgRep="";
				}//endif

			}//endif
		}//endif
	}//endfor i

	/// Check missing note again
	for(let i=missingNotesArray.length-1;i>=0;i-=1){
		for(let n=0;n<matchEventsArray.length;n+=1){
			if(matchEventsArray[n].fmt1ID==missingNotesArray[i].fmt1ID){
				missingNotesArray.splice(i,1);
				break;
			}//endif
		}//endfor n
	}//endfor i

	for(let i=0;i<replacedFmt1IDs.length;i+=1){
		let found=-1;
		for(let n=0;n<matchEventsArray.length;n+=1){
			if(matchEventsArray[n].fmt1ID==replacedFmt1IDs[i]){
				found=n;
				break;
			}//endif
		}//endfor n
		if(found<0){
			let missingNote=new MissingNote();
			missingNote.fmt1ID=replacedFmt1IDs[i];
			let scorePos=FindFmt3xScorePos(missingNote.fmt1ID);
			if(scorePos[0]>=0){
				missingNote.stime=fmtEventsArray[scorePos[0]].stime;
				missingNotesArray.push(missingNote);
			}//endif
		}//endif
	}//endfor i

	edits=[];

}//end UpdateMatchData


document.getElementById('downloadButton').addEventListener('click', function(event){
	UpdateMatchData();
	let str='';
	for(let i=0;i<matchCommentsArray.length;i+=1){
		str+=matchCommentsArray[i]+"\n";
	}//endfor i
	for(let n=0;n<matchEventsArray.length;n+=1){
		let evt=matchEventsArray[n];
		str+=evt.ID+"\t"+evt.ontime+"\t"+evt.offtime+"\t"+evt.sitch+"\t"+evt.onvel+"\t"+evt.offvel+"\t"+evt.channel+"\t";
		str+=evt.matchStatus+"\t"+evt.stime+"\t"+evt.fmt1ID+"\t"+evt.errorInd+"\t"+evt.skipInd+"\n";
	}//endfor n
	for(let i=0;i<missingNotesArray.length;i+=1){
		str+="//Missing "+missingNotesArray[i].stime+"\t"+missingNotesArray[i].fmt1ID+"\n";
	}//endfor i

	const a = document.createElement('a');
	a.href = URL.createObjectURL(new Blob([str], {type: 'text/plain'}));
	a.download = 'match.txt';
	a.style.display = 'none';
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);

	document.getElementById('correctInfo').value="";
	drawScore();
});


document.getElementById('svgButton').addEventListener('click', function(event){
	let str=document.getElementById('display').innerHTML.slice(0,document.getElementById('display').innerHTML.indexOf('</svg>'))+'</svg>';
	str='<?xml version="1.0" encoding="UTF-8" standalone="no"?>'+str;
	const a = document.createElement('a');
	a.href = URL.createObjectURL(new Blob([str], {type: 'text/plain'}));
	a.download = 'out.svg';
	a.style.display = 'none';
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
});


/**
 * ページ読み込み時の初期化を行う
 */
function init(){
	// 読み込んだファイル名の初期化
	$("#filename1").text('');
	$("#filename2").text('');
	// スコア描画
	drawScore();
	return;
}


/**
 * ページが読み込まれた時に読み込まれる
 */
window.onload = function(){
	init();
}
