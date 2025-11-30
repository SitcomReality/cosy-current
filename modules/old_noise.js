


function getSomeNoise(x,y){
	let nsine = sine_wave(x,y), ncos = cos_wave(x,y), nsimplex = simplex(x,y), nperlin = perlin(x,y), n1,n2,n3;
	n1 = interpolate_noise(nsine, nsimplex);
	n2 = interpolate_noise(ncos, nperlin);
	n3 = interpolate_noise(n1,n2);
	return n3;
}


/* Interpolate between two noise values provided as arguments to generate smooth transitions */
let noise1_weight=1,noise2_weight=1;
function interpolate_noise(noise1,noise2){
	//console.log("attempting to interpolate "+noise1+" and "+noise2);
  let weight1=noise1_weight,weight2=noise2_weight;
  let noise=weight1*noise1+weight2*noise2;
  noise/=weight1+weight2;
  for(let i=0;i<smoothing;i++){
    weight1*=weight1;
    weight2*=weight2;
    let tmp_noise=weight1*noise1+weight2*noise2;
	//console.log(i + " - tmp_noise: "+tmp_noise);
    tmp_noise/=weight1+weight2;
	//console.log(i + " - tmp_noise: "+tmp_noise);
    noise=(noise*(smoothing-1-i)+tmp_noise*(i+1))/smoothing;
  }
  if (!noise || noise !== noise){ console.log("interpolation result: "+noise); console.log("ERROR: Failed noise interpolation."); return 0; }
  
  return(noise);
}

/*
let intensity0_weight=1, intensity1_weight=0.5;

function combine_noise(intensity0,intensity1){
  return intensity0*intensity0_weight+intensity1*intensity1_weight;
}

function interpolate(a,b,x){
  ft = x * Math.PI;
  f = (1 - Math.cos(ft)) * 0.5;
  return  a*(1-f) + b*f;
}
*/

/*
function sine_wave(x,y){
	let sinescalew = $("#mm_sinescalew").val();
	let sinescaleh = $("#mm_sinescaleh").val();
	return Math.sin(x/sinescalew)+Math.sin(y/sinescaleh);
}*/


function cos_wave(x,y){
	return Math.cos(x/7)+Math.sin(y/13);
}


/* smooth simplex noise */
function simplex(x,y){
	var grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
	var grad4 = [[0,1,1,1],[0,1,1,-1],[0,1,-1,1],[0,1,-1,-1],[0,-1,1,1],[0,-1,1,-1],[0,-1,-1,1],[0,-1,-1,-1],[1,0,1,1],[1,0,1,-1],[1,0,-1,1],[1,0,-1,-1],[-1,0,1,1],[-1,0,1,-1],[-1,0,-1,1],[-1,0,-1,-1],[1,1,0,1],[1,1,0,-1],[1,-1,0,1],[1,-1,0,-1],[-1,1,0,1],[-1,1,0,-1],[-1,-1,0,1],[-1,-1,0,-1],[1,1,1,0],[1,1,-1,0],[1,-1,1,0],[1,-1,-1,0],[-1,1,1,0],[-1,1,-1,0],[-1,-1,1,0],[-1,-1,-1,0]];
	var perm = [151,160,137,91,90,15, 131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33, 88,237,149,56,87,174,20,125,136,171,168, 68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54, 65,25,63,161,1,216,80,73,209,76,132,187,208, 89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152, 2,44,154,163, 70,221,153,101,155,167, 43,172,9,129,22,39,253, 19,98,108,110,79,113,224,232,178,185, 112,104,218,246,97,228, 251,34,242,193,238,210,144,12,191,179,162,241, 81,51,145,235,249,14,239,107,49,192,214, 31,181,199,106,157,184, 84,204,176,115,121,50,45,127, 4,150,254, 138,236,205,93,222,114, 67,29,24,72,243,141,128,195,78,66,215,61,156,180];
	var F2 = 0.5*(Math.sqrt(3.0)-1.0);
	var G2 = (3.0-Math.sqrt(3.0))/6.0;
	var F3 = 1.0/3.0;
	var G3 = 1.0/6.0;
	var F4 = (Math.sqrt(5.0)-1.0)/4.0;
	var G4 = (5.0-Math.sqrt(5.0))/20.0;
	var permMod12 = [];
	for(var i=0; i<512; i++)
		permMod12[i]=perm[i]%12;
	let n0=1,n1=1,n2=1,n3=1,n4=1;
	var s = (x+y)*F2;
	var i = Math.floor(x+s);
	var j = Math.floor(y+s);
	var t = (i+j)*G2;
	var x0 = x-(i-t);
	var y0 = y-(j-t);
	var i1,j1;
	if(x0>y0) {i1=1; j1=0;}
	else {i1=0; j1=1;}
	var x1 = x0-i1+G2;
	var y1 = y0-j1+G2;
	var x2 = x0-1.0+2.0*G2;
	var y2 = y0-1.0+2.0*G2;
	
	var x3 = x0-1.0+3.0*G3;
	var y3 = y0-1.0+3.0*G3;
	var x4 = x0-1.0+F4;
	var y4 = y0-1.0+F4;
	
	var ii = i & 255;
	var jj = j & 255;
	var t0 = 0.6-x0*x0-y0*y0;
	if(t0<0) n0 = 0.0;
	else {
		t0 *= t0;
		n0 = t0 * t0 * grad(perm[ii+perm[jj]], x0, y0);
	}
	var t1 = 0.6-x1*x1-y1*y1;
	if(t1<0) n1 = 0.0;
	else {
		t1 *= t1;
		n1 = t1 * t1 * grad(perm[ii+i1+perm[jj+j1]], x1, y1);
	}
	var t2 = 0.6-x2*x2-y2*y2;
	if(t2<0) n2 = 0.0;
	else {
		t2 *= t2;
		n2 = t2 * t2 * grad(perm[ii+1+perm[jj+1]], x2, y2);
	}
	
	
	var t3 = 0.6-x3*x3-y3*y3;
	if(t3<0) n3 = 0.0;
	else {
		t3 *= t3;
		n3 = t3 * t3 * grad(perm[ii+1+perm[jj+1]], x3, y3);
	}
	var t4 = 0.6-x4*x4-y4*y4;
	if(t4<0) n4 = 0.0;
	else {
		t4 *= t4;
		n4 = t4 * t4 * grad(perm[ii+1+perm[jj+1]], x4, y4);
	}
	return 27.0*(n0+n1+n2+n3+n4);
}

function grad(perml,x,y){
	var h = perml & 15;
	var u = h<8 ? x : y, v = h<4 ? y : h==12||h==14 ? x : 0;
	return ((h&1) == 0 ? u : -u) + ((h&2) == 0 ? v : -v);
}






function getPerlinNoiseAtCoord(x,y,seed){
let theta=seed*Math.PI*2;
let x1=x+Math.sin(theta);
let y1=y+Math.cos(theta);
let x2=x+Math.sin(theta+Math.PI*2/3);
let y2=y+Math.cos(theta+Math.PI*2/3);
let x3=x+Math.sin(theta+Math.PI*4/3);
let y3=y+Math.cos(theta+Math.PI*4/3);
let n=perlin(x1,y1)+perlin(x2,y2)+perlin(x3,y3);
return n/3;
}

function getPerlinNoise(x,y,seed){
let n=0;
let theta=seed*Math.PI*2;
let x1=x+Math.sin(theta);
let y1=y+Math.cos(theta);
let x2=x+Math.sin(theta+Math.PI*2/3);
let y2=y+Math.cos(theta+Math.PI*2/3);
let x3=x+Math.sin(theta+Math.PI*4/3);
let y3=y+Math.cos(theta+Math.PI*4/3);
n+=perlin(x1,y1);
n+=perlin(x2,y2);
n+=perlin(x3,y3);
n/=3;
return n;
}


function perlin(x,y){
let xy=x+y*57;
let abc=xy<<13;
let n=(1.0-((abc*(abc*abc*15731+789221)+1376312589)&0x7fffffff)/1073741824.0);
return n;
}






function noise(x,y){
	if(x==0){x=1;}
	if(y==0){y=1;}
    var rs = hash; //get random seed
    var e = (x*y *31.178694)%1; //multiply x,y by cubic interpolation
    var nn = (e*e*137.21321)%1; //cubic interpolation
    e = e+e;
    return (nn*0.5+Math.floor(e*rs))/rs; //sample noise using random seed
}
function getNoise(nx,ny) {
	return 0.5*(noise(nx,ny)+1);
}