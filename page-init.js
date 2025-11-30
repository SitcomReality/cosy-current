// Hook up existing jQuery-based controls and game functions

$(window).ready(function () {
  if (typeof onPageLoad === 'function') {
    onPageLoad();
  }
});

$("#btn_initgame").click(function () { 
  if (typeof initGame === 'function') {
    initGame();
  }
});

$("#btn_startpause").click(function () { 
  if (typeof gameStartPause === 'function') {
    gameStartPause();
  }
  if (typeof $(this).toggleText === 'function') {
    $(this).toggleText("START","PAUSE");
  }
});

$(".btn_move").click(function(){
  var dir = $(this).data("dir");
  if (dir === "up" || dir === "down") {
    if (typeof generateTileRow === 'function') {
      generateTileRow(dir);
    }
  } else {
    if (typeof generateTileColumn === 'function') {
      generateTileColumn(dir);
    }
  }
});

$("#btn_generatemap").click(function (){ 
  $("#minimap").empty();
  $("#minimap").addClass("loading"); 
  setTimeout(function(){
    if (typeof generateMiniMap === 'function') {
      generateMiniMap(); 
    }
  },100);
});

$("#btn_generatemapfromarray").click(function (){ 
  $("#minimap").empty();
  $("#minimap").addClass("loading"); 
  setTimeout(function(){
    if (typeof generateMiniMapFromArray === 'function') {
      generateMiniMapFromArray(); 
    }
  },100);
});