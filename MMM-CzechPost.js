Module.register("MMM-CzechPost",{
	
	defaults:{
		updateInterval: 5*60*1000, //every 5 minutes
		initialLoadDelay: 3000,
		retryDelay: 3000,
		lang: config.language,
		packagesUrl: "",
		postCode: "76001",
		showPostInfo: "all", //today, all, none
		showPackageInfo: "all", //latest, all
		tableClass: "small",
		maxNumOfShownPackages: 1,
		},
		
		getScripts: function(){
			return ['https://ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js']
		},
		
		getTranslations: function() {
			return { en: "translations/en.json",
					 cs: "translations/cs.json"
				   };
		},
		
		getStyles: function() {
		return ["MMM-CzechPost.css"];
		},
		
		start: function() {
			Log.info("Starting module: " + this.name);
			this.packages = [];
			this.packagesData = [];
			this.table;
			this.loaded = false;
			this.scheduleUpdate(this.config.initialLoadDelay);
			this.updateTimer = null;
		},
		
		getPackages: function(){
			var self = this;
			var retry = true;
			self.packages = [];
			var dataRequest = new XMLHttpRequest();
			var url = this.config.packagesUrl;
			$.get(url,function(response) {
				try{
					parser = new DOMParser();
					xmlDoc=parser.parseFromString(response,"text/xml");
				}
				catch(e){
					Log.log(e.message);
					return;
				}
				var metas = xmlDoc.getElementsByTagName("meta");
				for(var i=0; i<metas.length;i++){
					if(metas[i].getAttribute("property") == "og:description"){
						var res = metas[i].getAttribute("content");
						self.packages = res.replace(/\s+/g,",").split(",");				
					}
				}
				self.getPackagesData();
			});
		},
		
		getPackagesData: function(){
		if(this.packages.length > 0){	
			this.packagesData = [];
			for(var x=0; x<this.packages.length;x++){
				var self = this;
				var retry = true;
				var dataRequest = new XMLHttpRequest();
				if(this.config.lang === "cs"){
					var url = "https://thingproxy.freeboard.io/fetch/" + "https://b2c.cpost.cz/services/ParcelHistory/getDataAsJson?idParcel=" + this.packages[x];
				} else{var url = "https://thingproxy.freeboard.io/fetch/" + "https://b2c.cpost.cz/services/ParcelHistory/getDataAsJson?idParcel=" + this.packages[x] + "&language=en";}
				dataRequest.open("GET",url,false);
				dataRequest.onreadystatechange = function() {
				if(this.readyState === 4){
					if(this.status >= 200 && this.status < 400){
						self.packagesData.push(JSON.parse(this.response));
					}else {Log.error(self.name + ": Could not load packages.");}
					if (retry) {
						self.scheduleUpdate((self.loaded) ? -1 : self.config.retryDelay);
					}
				}
				};
				dataRequest.send();
			}
			this.loaded = true;
			this.updateDom();
		}else if(this.config.postCode === ""){			
			Log.error("No parcel numbers entered!");
			Log.error("No post code entered!");
			return;
		}else{this.loaded = true;
				this.updateDom();
				Log.error("No parcel numbers entered! Showing only post info.");}
		},
			
		getPostCodeData: function(postCode){
			var self = this;
			var retry = true;
			var temp;
			var dataRequest = new XMLHttpRequest();
			if(this.config.lang === "cs"){
				var url = "https://thingproxy.freeboard.io/fetch/" + "https://b2c.cpost.cz/services/PostOfficeInformation/v2/getDataAsJson?postCode=" + postCode;
			} else{var url = "https://thingproxy.freeboard.io/fetch/" + "https://b2c.cpost.cz/services/PostOfficeInformation/v2/getDataAsJson?postCode=" + postCode + "&language=en";}
			dataRequest.open("GET",url,false);
			dataRequest.onreadystatechange = function() {
			if(this.readyState === 4){
				if(this.status >= 200 && this.status < 400){
					temp = this.response; 
				}else {Log.error(self.name + ": Could not load post code.");}
				if (retry) {
					self.scheduleUpdate((self.loaded) ? -1 : self.config.retryDelay);
				}
			}
			};
			dataRequest.send();
			return JSON.parse(temp);
		},
		
		getDom: function(){
			var wrapper = document.createElement("div");
			wrapper.className = "czechPostWrapper";
			if (!this.loaded) {
				wrapper.innerHTML = this.translate("LOADING");
				wrapper.className = "dimmed light small";
				return wrapper;
			}
			if(this.config.packagesUrl != "" && this.packages.length > 0){
				
				this.table = document.createElement("table");
				this.table.className = this.config.tableClass;
				var row = document.createElement("tr");
				this.table.appendChild(row);
				var infoCell = document.createElement("th");
				infoCell.className = "infoTest";
				infoCell.setAttribute("colspan","2");
				infoCell.innerHTML = this.translate("INFO");
				row.appendChild(infoCell);
				
				var row = document.createElement("tr");
				row.className = "emptyRow";
				this.table.appendChild(row);
				
				for(var y=0; y < this.packages.length;y++){
					var row = document.createElement("tr");
					this.table.appendChild(row);
								
					var idCell = document.createElement("th");
					idCell.className = "packageId";
					idCell.setAttribute("colspan","2");
					idCell.innerHTML = this.translate("PACKAGE_INFO") + this.packagesData[y][0].id;
					row.appendChild(idCell);
						
					var row = document.createElement("tr");
					this.table.appendChild(row);
									
					var priceCell = document.createElement("td");
					priceCell.className = "price";
					priceCell.setAttribute("colspan","2");
					if(this.packagesData[y][0].attributes.dobirka != 0){
						priceCell.innerHTML = this.translate("PRICE") + this.packagesData[y][0].attributes.dobirka + " CZK";}
					row.appendChild(priceCell);
					
					var row = document.createElement("tr");
					this.table.appendChild(row);	
						
					if(this.packagesData[y][0].attributes.stored != ""){
						var storedCell = document.createElement("td");
						storedCell.className = "stored";
						storedCell.setAttribute("colspan","2");
						storedCell.innerHTML = this.translate("STORED") + this.packagesData[y][0].attributes.ulozeniDo;
						row.appendChild(storedCell);	
					}	
						
					var postCode = null;
					var postName = null;	
					if(this.config.showPackageInfo === "all" && this.packages.length <= this.config.maxNumOfShownPackages ){
							for(var x = 0; x < this.packagesData[y][0].states.state.length; x++){
								var row = document.createElement("tr");
								this.table.appendChild(row);
								
								var dateCell = document.createElement("td");
								dateCell.className = "packageDate";
								dateCell.innerHTML = this.packagesData[y][0].states.state[x].date;
								row.appendChild(dateCell);
									
								var textCell = document.createElement("td");
								textCell.className = "packageText";
								Log.log(this.packagesData);
								if(this.packagesData[y][0].states.state[x].id === "81" || this.packagesData[y][0].states.state[x].id === "91"){
									postCode = this.packagesData[y][0].states.state[x].postcode;
									postName = this.packagesData[y][0].states.state[x].postoffice;
									textCell.innerHTML = this.packagesData[y][0].states.state[x].text + "---" + this.packagesData[y][0].states.state[x].postoffice;
								}else {textCell.innerHTML = this.packagesData[y][0].states.state[x].text;}
								row.appendChild(textCell);
							}
								if(postCode != ""){
									var row = document.createElement("tr");
									row.className = "emptyRow";
									this.table.appendChild(row);
									this.showPostOfficeInfo(postCode,postName);
								}
								
								
								
						}else { var row = document.createElement("tr");
								this.table.appendChild(row);
								
								var single = this.packagesData[y][0].states.state.length - 1;
								
								var dateCell = document.createElement("td");
								dateCell.className = "packageDate";
								dateCell.innerHTML = this.packagesData[y][0].states.state[single].date;
								row.appendChild(dateCell);
									
								var textCell = document.createElement("td");
								textCell.className = "packageText";
								if(this.packagesData[y][0].states.state[single].id === "81" || this.packagesData[y][0].states.state[single].id === "91"){
									postCode = this.packagesData[y][0].states.state[single].postcode;
									postName = this.packagesData[y][0].states.state[single].postoffice;
									textCell.innerHTML = this.packagesData[y][0].states.state[single].text + "---" + this.packagesData[y][0].states.state[single].postoffice;
								}else {textCell.innerHTML = this.packagesData[y][0].states.state[single].text;}
								row.appendChild(textCell);
								
								if(postCode != null){
									var row = document.createElement("tr");
									row.className = "emptyRow";
									this.table.appendChild(row);
									this.showPostOfficeInfo(postCode,postName);
								}
							}
							
							var row = document.createElement("tr");
							row.className = "emptyRow";
							this.table.appendChild(row);
					}
				return this.table;	
					
			}else {
				this.table = document.createElement("table");
				this.table.className = this.config.tableClass;	
				this.showPostOfficeInfo(this.config.postCode,"");
				return this.table;
				}			
		},
		
		showPostOfficeInfo: function(postCode,postName){
			if(this.config.showPostInfo != "none"){
				var temp = this.getPostCodeData(postCode);
				var row = document.createElement("tr");
				this.table.appendChild(row);
									
				var postNameCell = document.createElement("th");
				postNameCell.className = "postInfo";
				postNameCell.setAttribute("colspan","2");
				
				if(postName === ""){
					postNameCell.innerHTML = this.translate("OPENING_HOURS") + temp[0].attributes.name;
				}else{postNameCell.innerHTML = this.translate("OPENING_HOURS") + postName;}
				row.appendChild(postNameCell);
				if(this.config.showPostInfo === "all" && this.packages.length <= this.config.maxNumOfShownPackages){
					for(var d=0; d<7; d++){
						var row = document.createElement("tr");
						this.table.appendChild(row);
						
						var dayCell = document.createElement("td");
						dayCell.className = "openingDay";
						dayCell.innerHTML = temp[0].openingHours.day[d].name; 
						row.appendChild(dayCell);
						
						var hoursCell = document.createElement("td");
						hoursCell.className = "openingHours";
						if(temp[0].openingHours.day[d].since3 === null && temp[0].openingHours.day[d].to3 === null){
							if(temp[0].openingHours.day[d].since2 === null && temp[0].openingHours.day[d].to2 === null){
								if(temp[0].openingHours.day[d].since1 != null && temp[0].openingHours.day[d].to1 != null){
									hoursCell.innerHTML = temp[0].openingHours.day[d].since1 + " - " + temp[0].openingHours.day[d].to1;
								}else{hoursCell.innerHTML = this.translate("CLOSED");}
							}else{hoursCell.innerHTML = temp[0].openingHours.day[d].since1 + " - " + temp[0].openingHours.day[d].to1 + "   " + temp[0].openingHours.day[d].since2 + " - " + temp[0].openingHours.day[d].to2}
						}else{hoursCell.innerHTML = temp[0].openingHours.day[d].since1 + " - " + temp[0].openingHours.day[d].to1 + "   " + temp[0].openingHours.day[d].since2 + " - " + temp[0].openingHours.day[d].to2 + "   " + temp[0].openingHours.day[d].since3 + " - " + temp[0].openingHours.day[d].to3}
						row.appendChild(hoursCell);
					}
				}else {
						var n = new Date();
						var d = n.getDay() - 1;
						var row = document.createElement("tr");
						this.table.appendChild(row);
						var dayCell = document.createElement("td");
						dayCell.className = "openingDay";
						dayCell.innerHTML = temp[0].openingHours.day[d].name; 
						row.appendChild(dayCell);
						
						var hoursCell = document.createElement("td");
						hoursCell.className = "openingHours";
						if(temp[0].openingHours.day[d].since3 === null && temp[0].openingHours.day[d].to3 === null){
							if(temp[0].openingHours.day[d].since2 === null && temp[0].openingHours.day[d].to2 === null){
								if(temp[0].openingHours.day[d].since2 != null && temp[0].openingHours.day[d].to2 != null){
									hoursCell.innerHTML = temp[0].openingHours.day[d].since1 + " - " + temp[0].openingHours.day[d].to1;
								}else{hoursCell.innerHTML = this.translate("CLOSED");}
							}else{hoursCell.innerHTML = temp[0].openingHours.day[d].since1 + " - " + temp[0].openingHours.day[d].to1 + "   " + temp[0].openingHours.day[d].since2 + " - " + temp[0].openingHours.day[d].to2}
						}else{hoursCell.innerHTML = temp[0].openingHours.day[d].since1 + " - " + temp[0].openingHours.day[d].to1 + "   " + temp[0].openingHours.day[d].since2 + " - " + temp[0].openingHours.day[d].to2 + "   " + temp[0].openingHours.day[d].since3 + " - " + temp[0].openingHours.day[d].to3}
						row.appendChild(hoursCell);
					}
			}	
		},
		scheduleUpdate: function(delay) {
			var nextLoad = this.config.updateInterval;
			if (typeof delay !== "undefined" && delay >= 0) {
				nextLoad = delay;
			}
			var self = this;
			clearTimeout(this.updateTimer);
			this.updateTimer = setTimeout(function() {
				if(self.config.packagesUrl != ""){
					self.getPackages(); 	
				}else if(self.config.postCode != ""){
						self.loaded = true;
						self.updateDom();	
				}else{Log.error("Post code not set!");
						return;}			
			}, nextLoad);
		},
	});
