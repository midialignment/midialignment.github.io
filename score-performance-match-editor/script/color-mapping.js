/**
 * match line に色を付ける（音によって変える）
 * @param {*} i : sitchHeight
 */
function setMatchLineColor(i){
	let n = (i % 7 < 0) ? ((i % 7) + 7) : (i % 7 + 0);
	let ret = "";
	if (n == 0){ret = "#FF0461";} // C or C# : red
	else if(n == 1){ret = "#FF6928";} // D or D# : orange
	else if(n == 2){ret = "#FFD700";} // E : yellow
	else if(n == 3){ret = "#43FF6B";} // F or F# : green
	else if(n == 4){ret = "#46EEFF";} // G or G# : lightblue
	else if(n == 5){ret = "#2C7CFF";} // A or A# : blue
	else if(n == 6){ret = "#7B3CFF";} // B : purple
	else {ret = "#000000"}
	return ret;
}


/**
 * ノートの色を決定する
 * @param {Number} channel チャンネル番号
 */
function channelToColor(channel){
	if (channel == 0){return "background-color:rgba(50,255,0,0.4); color:black;";}
	else if (channel == 1){return "background-color:rgba(255,120,30,0.4); color:blue;";}
	else if (channel == 2){return "background-color:rgba(255,30,120,0.4); color:aqua;";}
	else if (channel == 3){return "background-color:rgba(30,120,255,0.4); color:aqua;";}
	else if (channel == 4){return "background-color:rgba(120,30,120,0.4); color:aqua;";}
	else if (channel == 5){return "background-color:rgba(255,255,30,0.4); color:aqua;";}
	else if (channel == 6){return "background-color:rgba(30,255,255,0.4); color:aqua;";}
	else if (channel == 7){return "background-color:rgba(255,30,30,0.4); color:aqua;";}
	else if (channel == 8){return "background-color:rgba(120,30,30,0.4); color:aqua;";}
	else if (channel == 9){return "background-color:rgba(120,180,0,0.4); color:aqua;";}
	else if (channel == 10){return "background-color:rgba(30,180,180,0.4); color:aqua;";}
	else if (channel == 11){return "background-color:rgba(255,180,180,0.4); color:aqua;";}
	else {return "background-color:rgba(120,120,120,0.4); color:white;";}
}

function accToColor(acc,onvel){
	if (acc == 0){return "rgba(255,128,0,"+String(0.4*Math.pow(onvel/128.,0.5))+")";}
	else if (acc == 1){return "rgba(0,0,0,"+String(0.4*Math.pow(onvel/128.,0.5))+")";}
	else if (acc == 2){return "rgba(255,0,0,"+String(0.4*Math.pow(onvel/128.,0.5))+")";}
	else if (acc == -1){return "rgba(0,120,0,"+String(0.4*Math.pow(onvel/128.,0.5))+")";}
	else if (acc == -2){return "rgba(0,255,255,"+String(0.4*Math.pow(onvel/128.,0.5))+")";}
	else {return "rgba(0,0,0,1)";}
}

function errToColor(i){
	let ret = "";
	if (i == -2){ret = "rgba(255,20,255,1)";}
	else if (i == -1){ret = "rgba(200,100,50,1)";}
	else if (i == 1){ret = "rgba(255,69,0,1)";}
	else if (i == 2){ret = "rgba(0,255,0,1)";}
	else if (i == 3){ret = "rgba(0,255,255,1)";}
	else {ret = "rgba(20,20,20,1)";}
	return ret;
}//end errToColor

/**
 * match の error indicator (errorInd)の値によって枠の色と太さを変更
 * -2 : Missing Note
 * -1 : Unmatched?
 * 0 : correct
 * 1 : pitch error
 * 2 : Extra note (note-wise)
 * 3 : Extra note (cluster-wise)
 * 4, 5: 未実装
 * @param {*} i 
 */
function setFrameColor(i){
    let ret = "";
    if (i == -2){ret = "border:3px solid rgba(255,20,255,1);";}
    else if (i == -1){ret = "border:3px solid rgba(200,100,50,1);";}
    else if (i == 1){ret = "border:3px solid rgba(255,69,0,1);";}
    else if (i == 2){ret = "border:3px solid rgba(0,255,0,1);";}
    else if (i == 3){ret = "border:3px solid rgba(0,255,255,1);";}
    else {ret = "border:1px solid rgba(20,20,20,1);";}
    return ret;
}