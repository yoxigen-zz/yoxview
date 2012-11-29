angular.module('TextsModule', [])
	.factory('texts', function() {
		var linksRegex = /([@#][^\s$\:,\.\(\)\!\?\"\'@#]+|https?:\/\/[^\s$\!]+)/g;
		return {
			formatText: function(text, currentSource){
				return text ? text.replace(linksRegex, function(result){
					var isExternalLink = /^h/.test(result),
						href = isExternalLink ? result : "?/" + currentSource + "/",
						className = "innerLink";

					if (/^#/.test(result)){
						href = href + "tag/" + result.slice(1);
						className += " tagLink";
					}
					else if (/^@/.test(result)){
						href = href + "user/" + result.slice(1);
						className += " userLink";
					}

					return "<a class='" + className + "' href=\"" + href + "\"" + (isExternalLink ? " target='_blank'" : "") + ">" + result + "</a>"
				}) : null;
			}
		}

	});