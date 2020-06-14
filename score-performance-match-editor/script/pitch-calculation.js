/**
 * 音名から楽譜へのマッピングを行う
 * @param {String} sitch 音名
 */
function sitchToSitchHeight(sitch){
	// 高さ(C4の4などを拾う)
	let strLength = sitch.length;
	let octave = Number(sitch[strLength - 1]);
	// 音名と数値の対応 (C -> 0, D -> 1, ... A -> 5, B -> 6)
	let pitch = String(sitch[0]);
	let ht = 0;
	
	if (pitch == "C"){ht = 0;}
	else if(pitch == "D"){ht = 1;}
	else if(pitch == "E"){ht = 2;}
	else if(pitch == "F"){ht = 3;}
	else if(pitch == "G"){ht = 4;}
	else if(pitch == "A"){ht = 5;}
	else if(pitch == "B"){ht = 6;}
	else {ht = 0;}

	let ret = ht + 7 * (octave - 4);

	return ret;
}


/**
 * 音名から臨時記号に対応する値へのマッピング
 * @param {String} sitch 
 */
function sitchToAcc(sitch){
	let accLab = sitch.slice(1,sitch.length-1);

	if (accLab=="#" || accLab=="+"){
		return 1;
	}
	else if (accLab=="##" || accLab=="++"){
		return 2;
	}
	else if (accLab=="b" || accLab=="-"){
		return -1;
	}
	else if (accLab=="bb" || accLab=="--"){
		return -2;
	}
	else {
		return 0;
	}
}

function SitchToPitch(sitch){
	let p_rel,p;
	if(sitch[0]=='C'){p_rel=60;
	}else if(sitch[0]=='D'){p_rel=62;
	}else if(sitch[0]=='E'){p_rel=64;
	}else if(sitch[0]=='F'){p_rel=65;
	}else if(sitch[0]=='G'){p_rel=67;
	}else if(sitch[0]=='A'){p_rel=69;
	}else if(sitch[0]=='B'){p_rel=71;
	}//endif
	sitch=sitch.slice(1);
	let oct=Number(sitch[sitch.length-1]);
	sitch=sitch.slice(0,sitch.length-1);
	p=p_rel+(oct-4)*12;
	if(sitch==""){p+=0;
	}else if(sitch=="#"){p+=1;
	}else if(sitch=="##"){p+=2;
	}else if(sitch=="b"){p-=1;
	}else if(sitch=="bb"){p-=2;
	}else if(sitch=="+"){p+=1;
	}else if(sitch=="++"){p+=2;
	}else if(sitch=="-"){p-=1;
	}else if(sitch=="--"){p-=2;
	}//endif
	return p;
}//end SitchToPitch
