
/* SitcomReality's perfectly well-thought out noise generation algorithm that's definitely based on a deep understanding of the maths involved.
	
	Goal: Provide an x,y co-ord and get a noise intensity value back. */
	
var nseed = hash;
	
function getNoiseIntensityAt(x,y){
	let sine1=sine_wave(x,y,sinescale1x,sinescale1y);
	//let sine2=sine_wave(x+sine2offset,y,sinescale2x,sinescale2y);
	let sine2=cos_wave(x+sine2offset,y+sine2offset,sinescale2x,sinescale2y);
	let perlin=perlin_noise(x,y,perlinscalex,perlinscaley),simplex=simplex_noise(x,y,simplexscalex,simplexscaley);
	let fourier=fourier_noise(x,y,fourier_phase,fourier_amplitude),jacobi=jacobi_noise(x,y,jacobi_period);
	let chebyshev=chebyshev_noise(x,y,chebyshev_strength,chebyshev_limit);
	
	//console.log("sine1: "+sine1+" | sine2: "+sine2+" | perlin: "+perlin+" | simplex: "+simplex+" | fourier: "+fourier+" | jacobi: "+jacobi+" | chebyshev: "+chebyshev);
	
	return interpolateNoises(sine1,sine2,perlin,simplex,fourier,jacobi,chebyshev);
}


function interpolateNoises(sine1,sine2,perlin,simplex,fourier,jacobi,chebyshev){
/* interpolate between the noise values to create smooth gradients, returning clamped intensity value from 0-9. */
	sine1=sine1*weight_sinewave1;
	sine2=sine2*weight_sinewave2;
	perlin=perlin*weight_perlin;
	simplex=simplex*weight_simplex;
	fourier=fourier*weight_fourier;
	jacobi=jacobi*weight_jacobi;
	chebyshev=chebyshev*weight_chebyshev;
	let total=sine1+sine2+perlin+simplex+fourier+jacobi+chebyshev;
	return Math.floor(Math.abs(total%9));
}



function linearInterpolate(a,b,x){
	return  a*(1-x)+b*x;
}


	/*
function interpolateNoises(sine1,sine2,perlin,simplex,fourier,jacobi,chebyshev){
	
	sine1 = sine1*weight_sinewave1;
	sine2 = sine2*weight_sinewave2;
	perlin = perlin*weight_perlin;
	simplex = simplex*weight_simplex;
	fourier = fourier*weight_fourier;
	jacobi = jacobi*weight_jacobi;
	chebyshev = chebyshev*weight_chebyshev;
	
	
	return (
		(sine1*weight_sinewave1+sine2*weight_sinewave2)/(weight_sinewave1+weight_sinewave2)
	+	(perlin*weight_perlin+simplex*weight_simplex+fourier*weight_fourier+jacobi*weight_jacobi+chebyshev*weight_chebyshev)/(weight_perlin+weight_simplex+weight_fourier+weight_jacobi+weight_chebyshev)
	)/(1+weight_sinewave1+weight_sinewave2+weight_perlin+weight_simplex+weight_fourier+weight_jacobi+weight_chebyshev); 
	
}*/
	
function sine_wave(x,y,sinescalex,sinescaley){
	//return Math.sin((x+y)*(1/sinescalex)+seed*(1/sinescaley));
	return Math.sin(x/sinescalex)+Math.sin(y/sinescaley);
}
function cos_wave(x,y,sinescalex,sinescaley){
	//return Math.sin((x+y)*(1/sinescalex)+seed*(1/sinescaley));
	return Math.cos(x/sinescalex)+Math.sin(y/sinescaley);
}
	
function chebyshev_noise(x,y,chebyshev_strength,chebyshev_limit){
	let total=0,position=1,step=0.5;
	for(let i=0;i<chebyshev_limit;i++){
		total+=(chebyshev_strength*chebyshev_t(position*x,position*y));
		position+=step;
		chebyshev_strength*=step;
	}
	return total;
}
	
function chebyshev_t(x,y){
	return (Math.abs(x)+Math.abs(y))/2;
}
	
function jacobi_noise(x,y,jacobi_period){
	let total=0,position=1,step=1,weight=1;
	for(let i=0;i<jacobi_period;i++){
		total+=(weight*jacobi_sigma(position*x,position*y));
		position+=step;
		weight*=step;
	}
	return total;
}
	
function jacobi_sigma(x,y){
	return (x+y)/2; // simply returns the average of y and x
}
	
function fourier_noise(x,y,fourier_phase,fourier_amplitude){
	/* return fourier_amplitude*Math.sin(fourier_phase*x+seed*y); */
	
	return fourier_amplitude * Math.sin(x * fourier_phase + y * fourier_phase * 2);
}


	
function perlin_noise(x,y,perlinscalex,perlinscaley){
	return (perlin(x*perlinscalex+seed,y*perlinscaley+seed)-0.5)*2;
}
	
function simplex_noise(x,y,simplexscalex,simplexscaley){
	return 0.5*simplex(x*simplexscalex+seed,y*simplexscaley+seed)+0.5;
}
	
function smoothNoise(x,y){
	let total=0,position=1,weight=1,clamped=0;
	for(let i=0;i<smoothing_passes;i++){
		total+=(weight*getNoiseIntensityAt(position*x,position*y));
		position+=smoothing;
		weight*=smoothing;
	}
	clamped=total%10;
	return clamped<0?10+clamped:clamped;
	//return total;
}
	


/* clamp values to 0-9 */
function clampedNoise(x,y){
	let clamped=getNoiseIntensityAt(x,y)%10;
	//console.log("Clamped: "+clamped);
	return clamped<0?10+clamped:clamped;
}






/* Smoothing, interpolation & wave function collapse.

map_tile_array is a 2 dimensional array storing an intensity value for every [x][y] coordinate in this format:
map_tile_array[0][0] = 9;
map_tile_array[0][1] = 6;

Intensity ranges from minimum 0 to maximum 9.

The following function compares nearby intensity values and tries to create smoother gradients by limiting the difference between adjacent values, so that the example would become:
map_tile_array[0][0] = 8;
map_tile_array[0][1] = 7;
 */

// get neighbouring coordinates
function get_neighbours(x,y,map_tile_array){
	let neighbours=[];
	for (let i=-1;i<2;i++){
		for (let j=-1;j<2;j++){
			if (i===0&&j===0){continue;} // don't compare with itself
			let nx=x+i,
				ny=y+j;
			if (nx<0||nx>=map_tile_array.length||ny<0||ny>=map_tile_array[0].length){continue;} // don't compare with values outside the map
			neighbours.push([nx,ny]);
		}
	}

	return neighbours;
}

// compare the value of x,y with its neighbours and apply smoothing
function compare_and_smooth(map_tile_array){
	
	getSettings();
	
	
	for (let x=0;x<map_tile_array.length;x++){
		for (let y=0;y<map_tile_array[0].length;y++){

			let neighbours=get_neighbours(x,y,map_tile_array);

			// iterate through each value in the array of neighbours
			for (let i=0;i<neighbours.length;i++){
				let nx=neighbours[i][0],
					ny=neighbours[i][1];
				let distance=Math.abs(x-nx)+Math.abs(y-ny);
				if (distance>maximum_compare_distance){continue;} // don't compare with values too far away

				if (map_tile_array[x][y]<map_tile_array[nx][ny]){
					if (map_tile_array[x][y]<map_tile_array[nx][ny]-max_difference){
						map_tile_array[x][y]++;
					}
				} else {
					if (map_tile_array[x][y]>map_tile_array[nx][ny]+max_difference){
						map_tile_array[x][y]--;
					}
				}
			}
		}
	}
}






function perm_noise(x,y){
/* Generates a smooth, infinitely permuting noise field */
	var p = [],
		i;
	for (i=0; i<256; i++)
		p[i] = Math.floor(Math.random()*256);
	var presult = Math.abs(
		noise3(
				x/permute1_scalex,
				y/permute1_scaley,
				random_seed+1)*permute1_weight
			+noise3((x+permute2_phase*random_seed)/permute2_period,
				(y+permute2_phase*random_seed)/permute2_period,
				random_seed)*permute2_weight
			+noise3((x+permute3_phase*random_seed)/permute3_period,
				(y+permute3_phase*random_seed)/permute3_period,
				random_seed)*permute3_weight
			+noise3((x+random_seed*0.1)/sine1_scalex,
				(y+random_seed*0.1)/sine1_scaley,
				random_seed+1)*sine1_weight
			+noise3((x+random_seed*0.1)/sine2_scalex,
				(y+random_seed*0.1)/sine2_scaley,
				random_seed+1)*sine2_weight
	);
	presult = presult * 9;
	return Math.floor(presult);
	//return presult%9;
}

function noise3(x,y,z)
{
	if (!x) { x = seededRand(seed); }
	if (!y) { y = seededRand(seed); }
	if (!z) { z = seededRand(seed); }
	var X=Math.floor(x), Y=Math.floor(y), Z=Math.floor(z);
	x -= X; y -= Y; z -= Z;
	var u=fade(x), v=fade(y), w=fade(z);
	var A=[X,X+1], B=[Y,Y+1], C=[Z,Z+1];
	var AA=perm[A[0]+perm[A[1]+perm[B[0]+perm[B[1]+perm[C[0]+perm[C[1]]]]]],
		AB=perm[A[0]+perm[A[1]+perm[B[0]+perm[B[1]+perm[C[1]+perm[C[0]]]]]],
		BA=perm[A[1]+perm[A[0]+perm[B[0]+perm[B[1]+perm[C[0]+perm[C[1]]]]]],
		BB=perm[A[1]+perm[A[0]+perm[B[0]+perm[B[1]+perm[C[1]+perm[C[0]]]]]];
	return lerp(w, lerp(v, lerp(u, grad(AA  , x  , y  , z   ),
									grad(BA  , x-1, y  , z   )),
								lerp(u, grad(AB  , x  , y-1, z   ),
									grad(BB  , x-1, y-1, z   ))),
						lerp(v, lerp(u, grad(AA+1, x  , y  , z-1 ),
									grad(BA+1, x-1, y  , z-1 )),
								lerp(u, grad(AB+1, x  , y-1, z-1 ),
									grad(BB+1, x-1, y-1, z-1 ))));
}
function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp( t, a, b) { return a + t * (b - a); }
function grad(hash,x,y,z) {
	var h = hash & 15;                      // Convert low 4 bits of hash code
	var u = h<8 ? x : y,                 // into 12 gradient directions
		 v = h<4 ? y : h==12||h==14 ? y : z;
	//return ((h&1) == 0 ? u : -u) + ((h&2) == 0 ? v : -v);
	/* finally, clamp value to whole integers between 0 and 9 */
	var clamped_result=Math.floor(
		(
			(h&1) == 0 ? u : -u) +
			((h&2) == 0 ? v : -v)
		);
	if (clamped_result<0)
		return 0;
	else if (clamped_result>9)
		return 9;
	else
		return clamped_result;
}


var perm = [],
	p, i;
for (i=0; i<256; i++)
	perm[i]=Math.floor(Math.random()*255);
/*
for (i=0; i<pixels; i++){
	pix[i] = perm_noise(i%width, Math.floor(i/width));
}*/