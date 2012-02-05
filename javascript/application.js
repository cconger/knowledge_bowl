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
		this._tiers = [[]];
		
		var matches = config.teams / 2;
		for(i = 0; i < matches; i++)
		{
			var seedMatch = new SeededMatch({
				team1: this._teams[(i*2)],
				team2: this._teams[(i*2)+1]
			});
			this._tiers[tierCounter].push(seedMatch);
			var match = Serenade.render('bracketMatch', seedMatch, new BracketController());
			document.getElementById("tier-" + tierCounter).appendChild(match);
		}
		tierCounter++;
		
		matches = matches / 2;
		while(matches >= 1)
		{
			this._tiers.push([]);
			for(i = 0; i < matches; i++)
			{
				var newMatch = new ResultantMatch(
				{
					team1Match: this._tiers[tierCounter - 1][(i*2)],
					team2Match: this._tiers[tierCounter - 1][(i*2)+1]
				});
				this._tiers[tierCounter].push(newMatch);
				var matchView = Serenade.render('bracketMatch', newMatch, new BracketController());
				document.getElementById("tier-" + tierCounter).appendChild(matchView);
			}
			tierCounter++;
			matches = matches / 2;
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
		var overlay_wrapper = document.getElementById("roundOverlay");
		overlay_wrapper.innerHTML = "";
		var roundView = Serenade.render("roundView", this.model, new OverlayController());
		overlay_wrapper.appendChild(roundView);
		app.showOverlay();
	}
});

var OverlayController = new Class(
{
	
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
			dependsOn: "topDeterminateMatch.winner",
			get: function(){
				return this.get("topDeterminateMatch").winner;
			}
		});
		this.property("teamBottom",{
			dependsOn: "bottomDeterminateMatch.winner",
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
				if(this.get('teamTopScore') > this._scoreCap)
				{
					return this.get('teamTop');
				}
				else if(this.get('teamBottomScore') > this._scoreCap)
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
				if(this.get('teamTopScore') > this._scoreCap)
				{
					return this.get('teamTop');
				}
				else if(this.get('teamBottomScore') > this._scoreCap)
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