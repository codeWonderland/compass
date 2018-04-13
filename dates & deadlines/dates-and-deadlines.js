const oneDayMill = 86400000; // The number of milliseconds in one day, to determine if dates are valid
var ccWaitTries = 10;
function waitForJQuery()
{
    if (window.$)
    {
        (function($)
        {
            console.log('in the anon function');
            $(document).ready(function()
            {
                console.log('in the dom ready');
                var deadlines = null;

                // Check for deadlines
                if (Modernizr.localstorage && localStorage.getItem('deadlines') !== null)
                {
                    console.log('have deadlines locally');
                    deadlines = $.parseJSON(localStorage.getItem('deadlines'));

                    // Make sure data is not expired
                    var twoHours = 1000 * 60 * 60 * 2, // two hours in milliseconds
                        now = new Date().getTime();

                    if (deadlines.date && now - deadlines.date < twoHours)
                    {
                        deadlines = deadlines.records;
                        handleDeadlines(deadlines);
                    }
                    else
                    {
                        deadlines = null;
                    }
                }

                if (!deadlines)
                {
                    console.log('fetching deadlines');

                    var spreadsheetID = "1qXcRHXYAo7tJ4PF1mJQOK6bbIa-UGS3GmpTGr1bBGDA";

                    // Make sure it is public or set to "anyone with link can view" or we can't pull the JSON
                    // The number after the spreadsheet id is 1 because we are using the first sheet in the
                    // google sheets doc
                    var url = "https://spreadsheets.google.com/feeds/list/" + spreadsheetID + "/1/public/values?alt=json";

                    var $deaddata = $.ajax({
                        url: url,
                        dataType: "jsonp"
                    });

                    $deaddata.done(function(data)
                    {
                        if (!data || !data.feed || !Object.keys(data.feed.entry).length)
                        {
                            console.log('Had a problem loading memory data! Data is: ');
                            console.log(data);
                            return;
                        }

                        if (data)
                        {
                            console.log('data from sheet:');
                            console.log(data);
                        }

                        var storedData =
                            {
                                records: data.feed.entry,
                                date: (new Date).getTime()
                            };

                        if (Modernizr.localstorage && JSON && JSON.stringify)
                        {
                            localStorage.setItem('deadlines', JSON.stringify(storedData));
                        }

                        deadlines = storedData.records;
                        handleDeadlines(deadlines);
                    })
                }
            });
        })(jQuery);
    } else
    {
        ccWaitTries--;
        if (ccWaitTries > 0)
        {
            setTimeout(waitForJQuery, 50);
        }
    }
}

waitForJQuery();

function handleDeadlines(deadlines)
{
    $deadlineContainer = $('tbody.deadline-container')[0];

    $deadlineContainer.innerHTML = '<tr><td><div class="loader"></div></td></tr>';
    console.log(deadlines);
    console.log('handling deadlines');

    // This string will be a total build of the html that we will push to the memory container
    var deadlinesString = "";

    if (deadlines.length)
    {
        console.log("Deadline length is not null");
        try
        {
            deadlines = orderDeadlines(deadlines);
            console.log('Ordering Deadlines Complete');
            console.log(deadlines);
        }
        catch (e)
        {
            console.log("Error ordering deadlines: ");
            console.log(deadlines);
            console.log("Deadlines will be inserted unsorted");
            console.log("Error desc:" + e);
        }

        try
        {
            deadlines = stripPastDeadlines(deadlines);
            console.log('Filtering Past Deadlines Complete');
            console.log(deadlines);
        }
        catch (e)
        {
            console.log("Error removing past deadlines: ");
            console.log(deadlines);
            console.log("Deadlines will be inserted regardless of their active state");
            console.log("Error desc:" + e);
        }

        console.log("Finished filtering / ordering data");

        $(deadlines).each(function()
        {
            try
            {
                deadlinesString += formatDeadlineHTML(this)
            }
            catch (e)
            {
                console.log("Error parsing deadline: " + this);
                console.log("Error desc: " + e);
            }
        });
    }
    else
    {
        deadlinesString = '' +
            '<tr>' +
            '   <td>' +
            '       <p class="deadline-error-message">No deadlines or dates matched the requested filter</p>' +
            '   </td>' +
            '</tr>'
    }

    console.log('Finished formatting data: ' + deadlinesString);

    $deadlineContainer.innerHTML = deadlinesString;
}

function orderDeadlines(deadlines)
{
    return deadlines.sort(function(a, b) {
        return Date.parse(a.gsx$date.$t) - Date.parse(b.gsx$date.$t);
    })
}

function stripPastDeadlines(deadlines)
{
    return deadlines.filter(function(deadline) {
        return Date.parse(deadline.gsx$date.$t) > (Date.now() - oneDayMill);
    })
}

function formatDeadlineHTML(deadline)
{
    // In this instance we do want type coercion to take effect so we use the single = in != versus !==
    if (deadline.gsx$description.$t != '' && deadline.gsx$category.$t != '' && deadline.gsx$date.$t != '')
    {
        return '' +
            '<tr>' +
            '   <td class="deadline-date"><p>' + deadline.gsx$date.$t + '</p></td>' +
            '   <td class="deadline-desc">' +
            '       <p>' +
            (
                deadline.gsx$link.$t != '' ?
                    '<a href="' + deadline.gsx$link.$t + '">' + deadline.gsx$description.$t + '</a>' :
                    deadline.gsx$description.$t
            ) +
            '       </p>' +
            '   </td>' +
            '<td class="deadline-cat">' + deadline.gsx$category.$t + '</td>';
    }
    else
    {
        console.log('Invalid Deadline Format: ' + deadline);
        return ''
    }
}

function filterDeadlines()
{
    if (Modernizr.localstorage && localStorage.getItem('deadlines') !== null)
    {
        console.log('have deadlines locally, filtering');
        var deadlines = $.parseJSON(localStorage.getItem('deadlines'));

        var category = $('#category-select').getAttribute('value');
        var term = $('#term-select').getAttribute('value');

        // Filter category first as that will theoretically remove the most
        // Things out if the client stays on top of removing old term data
        if (category !== 'any')
        {
            deadlines.filter(function(deadline) {
                return deadline.gsx$category.$t === category;
            })
        }

        if (term !== 'any')
        {
            deadlines.filter(function (deadline) {
                return deadline.gsx$term.$t === term;
            })
        }

        handleDeadlines(deadlines);
    }
    else
    {
        alert('Please wait for the deadlines to load before filtering them');
    }
}