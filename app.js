const convert = require ("xml-to-json-promise");
const ejs     = require ("ejs");
const express = require ("express");
const util    = require ("./util/newsletter-util.js");

const app = express ();
const newsletters_list = "http://www.example.com/configs/newsletters.json";

app.set ("view engine", "ejs");

app.get ("/newsletters/", function (req, res) {
	util.getContent (newsletters_list).then ((list_body) => {
		let list      = JSON.parse (list_body);
		let name_list = list.map (item => item.name)
		let data      = {
			items: name_list
		};
		res.render ("newsletters", data);
	});
});

app.get ("/newsletters/:newsletter", function (req, res) {
	util.getContent (newsletters_list).then (list_body => {
		let list = JSON.parse (list_body);
		let item = list.find (item => item.name === req.params.newsletter);
		let url = item.config;

		util.getContent (url).then (config_body => {
			let config = JSON.parse (config_body);
			util.getContent (config.template).then (template => {
				Promise.all(
					config.feeds.map (feed => util.getContent (feed.link))
				)
				.then (bodies => {
					Promise.all (
						bodies.map (body => convert.xmlDataToJSON (body, {explicitArray:false}))
					)
					.then (jsons => {
						const date = new Date();

						let data = { 
							month: util.months [date.getMonth()],
							day:   date.getDate(),
							year:  date.getFullYear()
						};

						for (let i = 0; i < jsons.length; i++) {
							let items;

							if (jsons [i].rss.channel.item) {
								items = Array.isArray (jsons [i].rss.channel.item) ? jsons [i].rss.channel.item : [jsons [i].rss.channel.item];
							}
							else {
								items = [];
							}

							data [config.feeds[i].name] = items;
						}

						res.send ({
							status: "success",
							content: ejs.render (template, data)
						});
					})
					.catch (err => handle_error ("Error @ xml feed parse to JSON step: ", err, res));
				})
				.catch (err => handle_error ("Error @ xml feed request: ", err, res));
			})
			.catch (err => handle_error ("Error @ ejs template request: ", err, res));
		})
		.catch (err => handle_error ("Error @ feed config request: ", err, res));
	})
	.catch (err => handle_error ("Error @ newsletters.json config request: ", err, res));
});

app.listen (3000, function () {
	console.log ("Listening on port 3000.");
});

function handle_error (error_message, err, res) {
	console.log (new Date() + ": ", error_message + err);
	res.send ({
		status: "error",
		content: (error_message + err)
	});
}
