/**
 * エラーリージョン関連のクラス
 */
class Region {
    constructor(regionsArray){
        this.regions = regionsArray;
    }

    /**
     * リージョンのクリア
     */
    clearRegions(){
        this.regions = [];
        return;
    }

    /**
     * リージョンの追加
     * @param {Number} t1 
     * @param {Number} t2 
     */
    addRegion(t1, t2){
        if (t1 >= t2){
            return;
        }
        this.regions.push([t1, t2]);
        return;
    }

    /**
     * 重なり合う region を除去する
     */
    removeOverlappingRegion(){
        let newRegion = [];
        let left = this.regions[0][0];
        let right = this.regions[0][1];
        this.regions.sort(regionSortFunction);

        for (let i = 1; i < this.regions.length; i++){
            let t1 = this.regions[i][0];
            let t2 = this.regions[i][1];
            if (t2 < right){
                continue;
            }
            else if(t1 <= right && right < t2){
                right = t2;
            }
            else if(right < t1){
                newRegion.push([left, right]);
                left = t1;
                right = t2;
            }
        }
        newRegion.push([left, right]);
        this.regions = newRegion;
        return;
    }
}


/**
 * region のソート用関数
 * @param {Array<Array>} a 
 * @param {Array<Array>} b 
 */
function regionSortFunction(a, b){
    if (a[0] != b[0]){
        if (a[0] < b[0]){
            return -1;
        }
        else if(a[0] > b[0]){
            return 1;
        }
        return 0;
    }
    else {
        if(a[1] < b[1]){
            return -1;
        }
        else if(a[1] > b[1]){
            return 1;
        }
        else {
            return 0;
        }
    }
}