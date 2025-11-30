let hash = Math.floor(Math.random*99), seed = hash, map_tile_array = new Array();
let random_seed = seed;

var dirlist = new Array("up","left","down","right");

let npc_elements=[];

//tiletype frequency settings: (defaults to normal ground) ["g"]
let	fgrx = 100, //max height of mountain ranges ["m"]
	fgrn = 2, //minimum level of mountain ranges ["m"]
	fgwx = -1, //max height that bodies of water appear ["w"]
	fgwn = -100, //min height that bodies of water appear ["w"]

	fgb = 0.3, //likelihood of spawning a forest tile (0-1) ["f"]
	fgc = 0.01, //the chance that a tile will be a city tile (0-1) ["c"]

	gbr = 25, //number of rows high (height of game map in tiles) 
	gbc = 50, //number of rows wide (width of game map) 
	grid_height=460,grid_width=960; //20 x width, 20 x height (not counting top, bottom rows, left and right cols)

let smoothing = 1,
	smoothing_passes = 1, //integer

	sinescale1x = 50,
	sinescale1y = 50,
	weight_sinewave1 = 4,
	
	sines2offset = 5,
	sinescale2x = 13,
	sinescale2y = 2,
	weight_sinewave2 = 0.08,
	
	perlinscalex = 13,
	perlinscaley = 17,
	weight_perlin = 0.1,
	
	simplexscalex = 1000,
	simplexscaley = 1000,
	weight_simplex = 0.6,
	
	fourier_phase = 0.9,
	fourier_amplitude = 1.1,
	weight_fourier = 0.2,
	
	jacobi_period = 11,
	weight_jacobi = 0,
	chebyshev_strength = 2,
	chebyshev_limit = 4,
	weight_chebyshev = 0.005,
	
	maximum_compare_distance=4, // how far to compare for smoothing. higher numbers lead to better results but exponentially increase algorithm run time
	max_difference=2; // maximum difference in intensity between adjacent values for smoothing
	
	
	
let	sine1_offset = 107,
	sine1_scalex = 239,
	sine1_scaley = 457,
	sine1_weight = 1.5,
	
	sine2_offset = -1001,
	sine2_scalex = 619,
	sine2_scaley = 739,
	sine2_weight = 1,
	
	permute1_scalex = 197,
	permute1_scaley = 379,
	permute1_weight = 0.5,
	
	permute2_phase = 3000,
	permute2_amplitude = 2000,	
	permute2_period = 380,
	permute2_wobble = 1.23,
	permute2_weight = 0.7,

	permute3_phase = 220,
	permute3_amplitude = 400,	
	permute3_period = 127,
	permute3_wobble = 20,
	permute3_weight = 1;

function onPageLoad(){
	/* Remove the JavaScript disabled warning on load */
	$("#nojs").remove();
	getSeedFromDOM();
	getSettings();
}

function getSettings(){
	smoothing = $("#mm_smoothing").val();
	smoothing_passes = $("#mm_smoothing_passes").val();
	
	sinescale1x = $("#mm_sinescale1x").val();
	sinescale1y = $("#mm_sinescale1y").val();
	weight_sinewave1 = $("#mm_sine1weight").val();
	
	sinescale2x = $("#mm_sinescale2x").val();
	sinescale2y = $("#mm_sinescale2y").val();
	sine2offset = $("#mm_sine2offset").val();
	weight_sinewave2 = $("#mm_sine2weight").val();
	
	perlinscalex = $("#mm_perlinscalex").val();
	perlinscaley = $("#mm_perlinscalex").val();
	weight_perlin = $("#mm_perlinweight").val();
	
	simplexscalex = $("#mm_simplexscalex").val();
	simplexscaley = $("#mm_simplexscaley").val();
	weight_simplex = $("#mm_simplexweight").val();
	
	fourier_phase = $("#mm_fourierphase").val();
	fourier_amplitude = $("#mm_fourieramp").val();
	weight_fourier = $("#mm_fourierweight").val();
	
	jacobi_period = $("#mm_jacobiperiod").val();
	weight_jacobi = $("#mm_jacobiweight").val();
	
	chebyshev_limit = $("#mm_chebyshevlimit").val();
	chebyshev_strength = $("#mm_chebyshevstrength").val();
	weight_chebyshev = $("#mm_chebyshevweight").val();
	
	max_difference = $("#mm_smoothcomparelimit").val();
	maximum_compare_distance = $("#mm_smoothmaxdifference").val();
	
	//version 2
	
	sine1_offset = $("#mm_sine1_offset").val();
	sine1_scalex = $("#mm_sine1_scalex").val();
	sine1_scaley = $("#mm_sine1_scaley").val();
	sine1_weight = $("#sine1_weight").val();
	
	sine2_offset = $("#mm_sine2_offset").val();
	sine2_scalex = $("#mm_sine2_scalex").val();
	sine2_scaley = $("#mm_sine2_scaley").val();
	sine2_weight = $("#sine2_weight").val();
	
	permute1_scalex = $("#mm_permute1_scalex").val();
	permute1_scaley = $("#mm_permute1_scaley").val();
	permute1_weight = $("#mm_permute1_weight").val();
	
	permute2_phase = $("#mm_permute2_phase").val();
	permute2_amplitude = $("#mm_permute2_amplitude").val();
	permute2_period = $("#mm_permute2_period").val();
	permute2_wobble = $("#mm_permute2_wobble").val();
	permute2_weight = $("#mm_permute2_weight").val();

	permute3_phase = $("#mm_permute3_phase").val();
	permute3_amplitude = $("#mm_permute3_amplitude").val();
	permute3_period = $("#mm_permute3_period").val();
	permute3_wobble = $("#mm_permute3_wobble").val();
	permute3_weight = $("#mm_permute3_weight").val();
}



function initGame(){
	getSeedFromDOM();
	for (var i=0;i<gbr;i++){
		generateTileRow("up");
	}
	//initMidField();
	$("#gamecover").remove();
}

function getSeedFromDOM() {
	hash = hashCode($("#set_seed").val());
	seed = hash;
	random_seed = hash;
	console.log("hash: "+hash);
}

function generateMiniMap(){
	
	let mw = $("#mm_width").val(), mh = $("#mm_height").val();
	
	getSettings();
	
	
	console.log("Minimap generating @ "+Date.now()+" for "+mw+" x "+mh);
	let nn = 0, nr = '', inner_array=[], outer_array=[];
	for (var iy=0;iy<mh;iy++){
		for (var ix=0;ix<mw;ix++){
			/*
			nn = 2+sine_wave(iy,ix);
			nn = Math.floor(nn * 2.9);
			nn = Math.abs(nn-2);
			*/
			/*
			nn = 2+getNoiseIntensityAt(iy,ix);
			nn = Math.floor(nn * 2.9);
			nn = Math.abs(nn-2);
			*/
			//nn = getNoiseIntensityAt(iy,ix);
			//nn = Math.floor(smoothNoise(iy,ix));
			nn = perm_noise(iy,ix);
			//console.log("Noise: "+nn);
			nr=nr+'<m class="m'+nn+'"></m>';
			
			inner_array.push(nn);
		}
		$('#minimap').append('<mr>'+nr+'</mr>');
		nr = '';
		outer_array.push(inner_array);
		inner_array=[];
	}
	map_tile_array=outer_array;
	console.log("Completed minimap generation.");
	console.log("-----------------");
	$("#minimap").removeClass("loading");
}





function generateMiniMapFromArray(){
	
	let mw = map_tile_array[0].length, mh = map_tile_array.length;
	
	console.log("Minimap generating @ "+Date.now()+" for "+mw+" x "+mh);
	let nn = 0, nr = '';
	for (var iy=0;iy<mh;iy++){
		for (var ix=0;ix<mw;ix++){
			nr=nr+'<m class="m'+map_tile_array[ix][iy]+'"></m>';
		}
		$('#minimap').append('<mr>'+nr+'</mr>');
		nr = '';
	}
	console.log("Completed minimap generation.");
	console.log("-----------------");
	$("#minimap").removeClass("loading");
}







function hashCode(hstring) {
  var hashc = 0, i, chr;
  if (!hstring || hstring.length === 0) { hstring = Math.floor(Math.random()*(Math.random()*100)*(Math.random()*100)); hstring = ""+hstring; }
  for (i = 0; i < hstring.length; i++) {
    chr   = hstring.charCodeAt(i);
    hashc  = ((hashc << 5) - hashc) + chr;
    hashc |= 0; // Convert to 32bit integer
  }
  if (hashc == 0) {
	  hashc = Math.floor(Math.random()*(Math.random()*100)*(Math.random()*100));
	  console.log("Seed hashed to 0. Generated new random hash: "+hashc);
  }
  return hashc;
};

function seededRand(seed){
//takes a 32bit integer (seed) and returns a value between 0-1
if (seed == null) {
		 seed = hashCode("default");
     }
     seed = (seed ^ 0x5deece66d) & 0xffffffff;
     seed = (seed * 0x5deece66d + 0xb) & 0xffffffff;
     return (seed >>> 0) / 0x100000000;
}







function checkModifiedTile(x,y){
	if (!map_tile_array || map_tile_array.length === 0 || !map_tile_array[x] || map_tile_array[x].length === 0 || !map_tile_array[x][y]) { return; }
	return map_tile_array[x][y];
}

function selectTile(noise) { /*returns tile type based on noise and tiletype frequency values */
	if(noise>fgwn&&noise<fgwx){ return "w"; }
	if(noise>fgrn&&noise<fgrx){ return "m"; }
	if(seededRand(noise*hash)<fgc){ return "c"; }
	if(seededRand(noise*hash)<fgb){ return "f"; }
	return "g";
}


function generateTileRow(direction) {
	var curr = $("#maptiles .tr").first().data("r"); //current row location
	var curc = $("#maptiles .tc").first().data("c"); //current column position
	var newrow = "";
	var newcolumns = "";
	if (direction == "up"){
		curr = curr - 1; //move one row up
		newrow = $('<div class="tr" data-r="'+curr+'" id="tr'+curr+'"></div>');	
		if ($("#maptiles .tr").length >= gbr) {
			$("#maptiles .tr").last().remove(); //remove the current bottom row if we've reached the gbr
		}
		$(newrow).prependTo("#maptiles"); //add the new row to the top
	}
	else {
		curr = curr + gbr; // move down by the height of the map (gbh)
		newrow = $('<div class="tr" data-r="'+curr+'" id="tr'+curr+'"></div>');	
		if ($("#maptiles .tr").length >= gbr) {
			$("#maptiles .tr").first().remove(); //remove the current top row if we've reached the gbr 
		}
		$(newrow).appendTo("#maptiles"); //add the new row to the bottom
	}
	
	for (var i=curc;i<curc+gbc;i++) {
		//var curn = getNoise(curr,i); //get noise value
		//var curn = map_tile_array[curr][i]; //get noise value
		//var tile = selectTile(curn); //select tile for this noise
		
		//var curn = Math.floor(smoothNoise(curr,i));
		var curn = perm_noise(curr,i);
		cmod=checkModifiedTile(curr,i);
		if ((1 + cmod) > 1){
			curn = cmod;
		}
		var tile=curn;
		var newtile = prepareTileElement(tile, i, "");
		newcolumns = newcolumns + newtile;
	}
	$(newcolumns).appendTo("#tr"+curr); //add the new columns to the new row
}

function generateTileColumn(direction){
	var curr = $("#maptiles .tr").first().data("r"); //current row location
	var curc = $("#maptiles .tc").first().data("c"); //current column position
	var newcolumns = "";
	
	if (direction == "left") {
		curc = curc - 1; //move left by one tile
		
		for (var i=curr;i<curr+gbc;i++) {// iterate through each row
			//var curn = getNoise(i,curc); //get noise value
			//var curn = map_tile_array[i][curc]; //get noise value
			//var tile = selectTile(curn); //select tile for this noise
			//var curn = Math.floor(smoothNoise(i,curc));
			var curn = perm_noise(i,curc);
			cmod=checkModifiedTile(i,curc);
			if ((1 + cmod) > 1){
				curn = cmod;
			}
			var tile=curn;
			var newtile = prepareTileElement(tile, curc, "");
			$("#tr"+i+" .tc").last().remove();
			$(newtile).prependTo('#tr'+i); // append the new column
		}
	}
	else {
		curc = curc + gbc; //move right the map width
		for (var i=curr;i<curr+gbc;i++) {// iterate through each row
			//var curn = map_tile_array[i][curc]; //get noise value
			//var tile = selectTile(curn); //select tile for this noise
			//var curn = Math.floor(smoothNoise(i,curc));
			var curn = perm_noise(i,curc);
			cmod=checkModifiedTile(i,curc);
			if ((1 + cmod) > 1){
				curn = cmod;
			}
			var tile=curn;
			var newtile = prepareTileElement(tile, curc, "");
			$("#tr"+i+" .tc").first().remove();
			$(newtile).appendTo('#tr'+i); // append the new column
		}
	}
}

function prepareTileElement(tiletype, col, innerhtml){
	//console.log(tiletype+" col:"+col+" inner:"+innerhtml);
	if (Math.random()>0.97) { innerhtml = prepareCoinElement(Math.floor(Math.random()*10)); }
	return '<div class="tc gt-'+tiletype+'" data-c="'+col+'">'+innerhtml+'</div>';
}
function prepareCoinElement(money_amount){
	if (money_amount < 1) { money_amount = 1; }
	return '<div class="coin"><div class="coin_outter"><div class="coin_inner"><span class="coin_text">'+money_amount+'</div></div></div></div>';
}






let gamestate=0, // 1 when game is running
	current_time=new Date().getTime(),
	delta_time=current_time,
	game_laststep=current_time,
	dt=current_time,
	game_stepT=0;
	
	
let gamespeed=1000; // tick length in milliseconds
/* First the start pause function.
Then the primary timing function for each gamestep which calls updateLogic() and updateGraphics(). Uses delta time to keep smooth gameplay if FPS drops. */

function gameStartPause(){
	if (gamestate < 1) {
		gamestate = 1;
		gameStart();

	}
	else {
		gamestate = 0;
		gamePause();

	}
}
function gameStart(){
	game_laststep=new Date().getTime();
	game_step();
}
function gamePause(){
	clearTimeout(game_stepT);
}
function game_step(){
	current_time=new Date().getTime();
	delta_time=current_time-game_laststep;
	game_laststep=current_time;
	dt= game_laststep/current_time;
	$("#game_dt").text(game_stepT%9); // debug purposes
	//updateLogic();
	//updateGraphics();
	if (gamestate==1) {
		game_stepT=setTimeout(game_step, gamespeed);
	}
	$("#game_fps").text(delta_time);
}


/*
function gameStartPause(started){
	if (started==1) {
		$("#btn_startpause").text("Pause");
		$("#game_dt").text("0");
		$("#game_fps").text("0");
		$("#game_score").text("0");
		//updateLogic();
		lastframe=Date.now();
		//requestAnimationFrame(gameLoop);
	}
	else {
		$("#btn_startpause").text("Start");
	}
}
function gameLoop(){
	// deltaTime is the difference in time between this frame and the last frame in seconds
	let currentTime=Date.now();
	let deltaTime=(currentTime-lastframe)/1000;

	let fps=Math.round(1/deltaTime);
	$("#game_dt").text("dt: "+deltaTime);
	$("#game_fps").text("fps: "+fps);
	// update game logic
	updateLogic(deltaTime);
	// update game graphics
	updateGraphics(deltaTime);
	// update the lastframe time to be the current time for the next frame
	lastframe=currentTime;
	// request the next frame to be drawn
	if (gamestate==1) {requestAnimationFrame(gameLoop);}
}
*/

	function countAdjacentFriends(npcx,npcy){
		let friend_count=0,friend_count_left=0,friend_count_right=0,friend_count_up=0,friend_count_down=0;
		if (npcx>0){
			if (npcs[game_map.getTile(npcx-1,npcy).npcid]){
				friend_count_left=1;
			}
		}
		if (npcx<game_map.width-1){
			if (npcs[game_map.getTile(npcx+1,npcy).npcid]){
				friend_count_right=1;
			}
		}
		if (npcy>0){
			if (npcs[game_map.getTile(npcx,npcy-1).npcid]){
				friend_count_up=1;
			}
		}
		if (npcy<game_map.height-1){
			if (npcs[game_map.getTile(npcx,npcy+1).npcid]){
				friend_count_down=1;
			}
		}
		friend_count=friend_count_left+friend_count_right+friend_count_up+friend_count_down;
		return friend_count;
	}
			



let npc_modify_tile_chance=0.1, // base chance that NPC alters the height of the tile it's standing on
	npc_restlessness=0.3, // base chance that the NPC will want to move to another tile
	npc_height_max=8, // the maximum height of a tile an NPC can stand on
	npc_height_min=2, // minimum height of a tile an NPC can stand on
	npc_direction_bias=0.7, // the likelihood the NPC will move in the same direction it moved previously (reduce likelihood of backtracking)
	npc_height_bias_pref=5, // the ideal height that the NPC would move towards
	npc_height_bias_strength=0.4, // how much the height bias influences decisions
	npc_friend_bias=0.8, // if a friendly NPC is nearby, how much do I want to be adjacent to them?
	npc_friend_annoyance_min_time=20, // how many gamesteps will I stay beside friends before I'll get bored and want to move away?
	npc_friend_annoyance_duration=50, // the number of steps after getting annoyed that I'll want to be close to friends again
	npc_friend_search_distance; // how many tiles away can we see friends?

//------------------------------------------------
//				Game logic
//------------------------------------------------

// Get every active NPC to do things
function npcVolition(){
	for (var i=0;i<active_npc_array.length;i++){
		let npcid=active_npc_array[i];
		let npc=npcs[npcid];
		let npcx=npc.x,npcy=npc.y,previous_direction=npc.last_move_dir,current_annoyance=npc.annoyance,annoyance_duration_remaining=npc.annoyanceremaining;
		let adjacent_friends = countAdjacentFriends(npcx,npcy), nearest_friend=findNearestFriend(npcx,npcy,npc_friend_search_distance);
		// check if I'm standing on a tile that's too tall
		if (game_map.getTile(npcx,npcy).height > npc_height_max){
			npcMove(npcid,0); // find a new tile
		}
		// check if I'm standing on a tile that's too short
		else if (game_map.getTile(npcx,npcy).height < npc_height_min){
			npcMove(npcid,0); // find a new tile
		}
		// check if I'm just standing around too much, and want to move
		else if (Math.random() < npc_restlessness){
			npcMove(npcid,0); // find a new tile
		}
		// check if I'm getting annoyed from nearby friends and going to move soon
		else if (current_annoyance<npc_friend_annoyance_min_time && annoyance_duration_remaining < 1){
			if (adjacent_friends>0){
				npc.annoyance=npc.annoyance+adjacent_friends; // I'm next to friends so I am growing annoyed
				if (npc.annoyance > npc_friend_annoyance_min_time) {
					npc.annoyanceremaining=npc_friend_annoyance_duration; // now I'm annoyed and don't want to be around friends
				}
			} else {
				npc.annoyance--; // I'm not next to a friend so I'll get less annoyed
				npc.annoyanceremaining--; // I will tolerate friends again when this reaches 0
			}
		}
		// check if I'm annoyed by friends and want to move away
		else if (current_annoyance>=npc_friend_annoyance_min_time || annoyance_duration_remaining > 1) {
			npcMove(npcid,0); // find a new tile
		}
		// if there's a nearby friend, I'll want to go towards them
		else if (nearest_friend !== false && Math.random() < npc_friend_bias){
			npcMove(npcid,nearest_friend.direction); // find a new tile
		}
		// otherwise, I'll want to move in the same direction as last time
		else if (previous_direction !== undefined && Math.random() < npc_direction_bias) {
			npcMove(npcid,previous_direction); // find a new tile
		}
		// otherwise, I'll want to move in a random direction
		else {
			npcMove(npcid,Math.floor(Math.random()*4)); // find a new tile
		}
	}
}











function addToNPCArray() {
	$(".npc").each(function(){ npc_elements.push(this) });
}

/* add visible npcs to the npc_elements[] array. */


/* init the npc object class to access the coordinates for each npc_elements[]
$(this).parent().data("c")			= npc.y // the y co-ord
$(this).parent().parent().data("r")	= npc.x // the x location
*/

/*
	npc_elements[0].data("c")			= npc.y // the y co-ord
	npc_elements[0].parent().data("r")	= npc.x // the x location
*/

/* get a list of the coordinates of all visible npcs */
$.each(npc_elements, function(i){

	npc_coordinates.push({"x": $(this).parent().parent().data("r"), "y": $(this).parent().data("c")});

	console.log(npc_coordinates[i]);
});













// https://stackoverflow.com/a/39525988 from 2015 but you know why not
$.fn.extend({
    toggleText: function(a, b){
        return this.text(this.text() == b ? a : b);
    }
});