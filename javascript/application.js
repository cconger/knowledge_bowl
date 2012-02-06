var App = new Class(
{
	initialize: function (config)
	{
		this._teams = [];
		config.teams = config.teams || 8;
		for(var i = 0; i < config.teams; i++)
		{
			this._teams.push(new Team({teamName: "Team" + (i + 1)}));
		}
		
		var tierCounter = 0;
		this._tiers = [];
		
		var matches = config.teams / 2;
		var first = true;
		while(matches >= 1)
		{
			this._tiers.push([]);
			for(i = 0; i < matches; i++)
			{
				var newMatch;
				if(first)
				{
					newMatch = new SeededMatch({
						team1: this._teams[(i*2)],
						team2: this._teams[(i*2)+1]
					});
				}
				else
				{
					newMatch = new ResultantMatch(
					{
						team1Match: this._tiers[tierCounter - 1][(i*2)],
						team2Match: this._tiers[tierCounter - 1][(i*2)+1]
					});
				}
				this._tiers[tierCounter].push(newMatch);
				var matchView = Serenade.render('bracketMatch', newMatch, new BracketController());
				document.getElementById("tier-" + tierCounter).appendChild(matchView);
			}
			tierCounter++;
			matches = matches / 2;
			first = false;
		}
		
		this._overlay = document.getElementById("roundOverlay");
		var self = this;
		this._overlay.addEventListener("click", function(evt){ self.hideOverlay(evt); });
	},
	
	showOverlay: function()
	{
		Co.Routine(this, [
			function()
			{
				this._overlay.style.display = "block";
				this._overlay.style.opacity = 0;
				return Co.Yield();
			},
			function(res)
			{
				res = res();
				this._overlay.style.opacity = 1;
			}
		]);
	},
	hideOverlay: function(evt)
	{
		if(evt && evt.target !== this._overlay)
		{
			return;
		}
		Co.Routine(this, [
			function()
			{
				this._overlay.style.opacity = 0;
				return Co.Sleep(1);
			},
			function(res)
			{
				res = res();
				this._overlay.style.display = "none";
			}
		]);
	}
});

var BracketController = new Class(
{
	nodeClicked: function (evt)
	{
		if(!this.model.get("active"))
		{
			return;
		}
		var overlay_wrapper = document.getElementById("roundOverlay");
		overlay_wrapper.innerHTML = "";
		var roundView = Serenade.render("roundView", this.model, new OverlayController());
		overlay_wrapper.appendChild(roundView);
		app.showOverlay();
	}
});

var TeamController = new Class(
{
	teamClicked: function (evt)
	{
		console.log(evt, this);
		if(this.model !== TBDTEAM)
		{
			var newName = prompt("Change team name?");
			//Awful practice I know. blocking calls make me sad.
			if(newName)
			{
				this.model.set("teamName", newName);
			}
			//TODO: change to in place edit.
		}
		evt.stopPropagation();
	}
});

Serenade.view('teamView', '.teamname[event:click=teamClicked] @teamName');
Serenade.controller('teamView', TeamController);

var OverlayController = new Class(
{
	topScoreClicked: function(event)
	{
		var newScore = this.model.teamTopScore + 1;
		if(event.shiftKey)
		{
			newScore = Math.max(0, newScore - 2);
		}
		this.model.set("teamTopScore", newScore);
	},
	bottomScoreClicked: function(event)
	{
		var newScore = this.model.teamBottomScore + 1;
		if(event.shiftKey)
		{
			newScore = Math.max(0, newScore - 2);
		}
		this.model.set("teamBottomScore", newScore);
	},
	closeClicked: function(event)
	{
		app.hideOverlay();
	},
	resetClicked: function(event)
	{
		this.model.set("teamTopScore", 0);
		this.model.set("teamBottomScore", 0);
	},
	swapClicked: function(event)
	{
		var topTeam,topScore = this.model.get("teamTopScore");
		if(this.model.get("topDeterminateMatch"))
		{
			topTeam = this.model.get("topDeterminateMatch");
			this.model.set("topDeterminateMatch", this.model.get("bottomDeterminateMatch"));
			this.model.set("bottomDeterminateMatch", topTeam);
		}
		else
		{
			topTeam = this.model.get("teamTop");
			this.model.set("teamTop", this.model.get("teamBottom"));
			this.model.set("teamBottom", topTeam);
		}
		this.model.set("teamTopScore", this.model.get("teamBottomScore"));
		this.model.set("teamBottomScore", topScore);
	}
});

var Team = new Class(Serenade.Model,
{
	classInitialize: function()
	{
		this.property('teamName');
	},
		
	initialize: function initialize(config)
	{
		for(var k in config)
		{
			this.set(k, config[k]);
		}
	}
});

const TBDTEAM = new Team({teamName: "TBD"});

var ResultantMatch = new Class(Serenade.Model,
{
	classInitialize: function()
	{
		this._scoreCap = 999999; //Insanely large value until overridden in constructor.
		
		this.property("teamTop",{
			dependsOn: ["topDeterminateMatch", "topDeterminateMatch.winner"],
			get: function(){
				return this.get("topDeterminateMatch").winner;
			}
		});
		this.property("teamBottom",{
			dependsOn: ["bottomDeterminateMatch", "bottomDeterminateMatch.winner"],
			get: function(){
				return this.get("bottomDeterminateMatch").winner;
			}
		});
		this.property("teamTopScore",
		{
			format: function(value){ return "" + value; }
		});
		this.property("teamBottomScore",
		{
			format: function(value){ return "" + value; }
		});
		this.property("winner",
		{
			dependsOn: ["teamTop", "teamBottom", "teamTopScore", "teamBottomScore"],
			get: function(){
				if(this.get('teamTopScore') >= this._scoreCap)
				{
					return this.get('teamTop');
				}
				else if(this.get('teamBottomScore') >= this._scoreCap)
				{
					return this.get('teamBottom');
				}
				else
				{
					return TBDTEAM;
				}
			}
		});
		this.property("active",
		{
			dependsOn: ["teamTop", "teamBottom"],
			get: function(){
				return this.get("teamTop") !== TBDTEAM &&
				       this.get("teamBottom") !== TBDTEAM;
			},
			format: function(value)
			{
				return "active-" + value;
			}
		});
	},
	
	initialize: function initialize(config)
	{
		this.set("topDeterminateMatch", config.team1Match);
		this.set("bottomDeterminateMatch", config.team2Match);
		this._scoreCap = config.scoreCap || 11;
		this.set("teamTopScore", 0);
		this.set("teamBottomScore", 0);
	}
});

var SeededMatch = new Class(Serenade.Model,
{
	classInitialize: function()
	{
		this._scoreCap = 999999; //Insanely large value until overridden in constructor.
		this.property("teamTop");
		this.property("teamBottom");
		this.property("teamTopScore",
		{
			format: function(value){ return "" + value; }
		});
		this.property("teamBottomScore",
		{
			format: function(value){ return "" + value; }
		});
		this.property("winner",
		{
			dependsOn: ["teamTop", "teamBottom", "teamTopScore", "teamBottomScore"],
			get: function(){
				if(this.get('teamTopScore') >= this._scoreCap)
				{
					return this.get('teamTop');
				}
				else if(this.get('teamBottomScore') >= this._scoreCap)
				{
					return this.get('teamBottom');
				}
				else
				{
					return TBDTEAM;
				}
			}
		});
	},
	
	initialize: function initialize(config)
	{
		this.set("teamTop", config.team1);
		this.set("teamBottom", config.team2);
		this._scoreCap = config.scoreCap || 11;
		this.set("teamTopScore", 0);
		this.set("teamBottomScore", 0);
		this.set("active", true);
	}
});

window.onload = function() {
    var element, script, _i, _len, _ref;
    _ref = document.getElementsByTagName('script');
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      script = _ref[_i];
      if (script.getAttribute('type') === 'text/x-serenade') {
        Serenade.view(script.getAttribute('id'), script.innerText.replace(/^\s*/, ''));
      }
    }
		app = new App({teams: 8});
};