
function AppointmentSummeryController($scope, AdminService, $uibModal, $log, $filter, UtilityService, $timeout, $rootScope, MessagingService,  $confirm, notify, ngDialog, locale){


    $scope.openAppointmentModal = function(operation) {
        var modalInstance = $uibModal.open({
            templateUrl: $rootScope.modePrefix+'/common/app/html/templates/'+window.device+'/admin/visits/modal/edit-appointment.modal.html',
            controller: 'UpdateAppointmentController',
            scope: $scope,
            backdrop: 'static',
            size: 'sm',
            resolve: {
                data: function() {

                    if(operation == "add"){
                        return {
                            operation: operation,
                            visitAppointment: null
                        }
                    }else{
                        return {
                            operation: operation,
                            visitAppointment: $scope.selectedAppointment
                        }
                    }
                    
                }
            }
        })
        modalInstance.result.then(function(selectedItem) {
            $scope.refreshData()
        }, function() {
            $log.debug('Modal dismissed at: ' + new Date())
            $scope.refreshData()
        })
    }

    $scope.removeAppointment = function(appointment){
        $log.debug("removeAppointment appointment", appointment)
        var date = moment(appointment.attendantRosterItem.startDate).format('YYYY-MM-DD')

        locale.ready('common').then(function() {
            $confirm({ title: locale.getString('visits.delete_appointment'), text: locale.getString('visits.are_you_sure_want_to_delete_appointment_for', { 1: appointment.visitJob.jobName, 2: appointment.visit.visitor.fullName, 3:date }) }).then(function() {
                AdminService.deleteAppointment(appointment.id, true).then(function (response) {
                    if (response.status === 200 && response.data.statusCode == "SUCCESS") {
                        $scope.refreshData()
                    } else {
                        alert("Delete appointment failed.")
                    }
                })
            })
        })
    }

    $scope.setAppointmentSate = function(completeAction, cancelAction){

        $log.debug("setAppointmentSate", $scope.selectedAppointment.attendantRosterItem)
    
        var appointmentCompleted = $scope.selectedAppointment.completed
        var appointmentCancelled = $scope.selectedAppointment.canceled

        if(appointmentCompleted == null)
                appointmentCompleted = false
        
        if(appointmentCancelled == null)
                appointmentCancelled = false

        if(completeAction == true){
            appointmentCompleted = !appointmentCompleted
        }
    

        if(cancelAction == true){
            appointmentCancelled = !appointmentCancelled
        }

        var visitAppointment = {}
        visitAppointment.id = $scope.selectedAppointment.id 
        visitAppointment.visitJob = {id: $scope.selectedAppointment.visitJob.id}
        visitAppointment.visit = {id : $scope.selectedAppointment.visit.id}
        visitAppointment.attendantRosterItem = {rosterItemId : $scope.selectedAppointment.attendantRosterItem.rosterItemId}
        visitAppointment.appointmentStart = $scope.selectedAppointment.visit.visitStart;
        visitAppointment.appointmentEnd = $scope.selectedAppointment.visit.visitEnd;
        visitAppointment.timeZone = new Date().getTimezoneOffset() * 60 * (-1)
        visitAppointment.sequenceIndex =0
        visitAppointment.completed = appointmentCompleted
        visitAppointment.canceled = appointmentCancelled

        AdminService.updateAppointment(appointmentId, jobId, visitId, rosterItemId, from, to, appointmentCompleted, appointmentCancelled, timezone).then(function (response) {
            if (response.status === 200 && response.data.statusCode == "SUCCESS") {
                
                if(completeAction == true){
                    notify({
                        message: moment.utc(response.data.returnValue.settingsValue * 1000).format('HH:mm:ss'),
                        position: "right",
                        messageTemplate: "<div><strong>" + (appointmentCompleted ? $filter('i18n')('visits.appointment_completed') : $filter('i18n')('visits.appointment_not_completed')) + "</strong></div>",
                        templateUrl: $scope.template,
                        classes: "alert alert-success left-align",
                        duration: 4000,
                        scope: $scope
                    })
                }

                if(cancelAction == true){
                    notify({
                        message: moment.utc(response.data.returnValue.settingsValue * 1000).format('HH:mm:ss'),
                        position: "right",
                        messageTemplate: "<div><strong>" + (appointmentCancelled ? $filter('i18n')('visits.appointment_cancelled') : $filter('i18n')('visits.appointment_not_cancelled'))  + "</strong></div>",
                        templateUrl: $scope.template,
                        classes: "alert alert-success left-align",
                        duration: 4000,
                        scope: $scope
                    })
                }
                
               $scope.refreshData()
             } else {
                MessagingService.sendMessage(response.data.statusCode)
            }
        }, function (errResponse) {
            UtilityService.showErrorModal(errResponse.data.error, errResponse.data.exception)
        })
    }

    $scope.openPrintTicketModel = function(ticketTemplateName, ticketViewTemplateName, customController){
        var modalInstance = $uibModal.open({
            templateUrl: $rootScope.modePrefix+'/common/app/html/templates/'+window.device+'/admin/visits/modal/print-ticket.modal.html',
            controller: customController == null ? 'printTicketContoller' : customController ,
            backdrop: 'static',
            scope: $scope,
            size: 'lg',
            resolve: {
                data: function() {
                    return {
                        visitAppointment: $scope.selectedAppointment,
                        ticketTemplate: "/web/public/template/"+ ticketTemplateName,
                        ticketViewTemplate: "/web/public/template/"+ticketViewTemplateName

                    }
                }
            }
        })
        // for getting a result after closing modal, not using now
        modalInstance.result.then(function() {}, function() {
            $log.debug('Modal dismissed at: ' + new Date())
        })
    }


}

App.controller('AppointmentSummeryController', AppointmentSummeryController)
AppointmentSummeryController.$inject = ['$scope', 'AdminService', '$uibModal', '$log', '$filter', 'UtilityService', '$timeout', '$rootScope', 'MessagingService', '$confirm', 'notify', 'ngDialog', 'locale']


function UpdateAppointmentController($scope, AdminService, $uibModalInstance, $log, data, $filter, UtilityService, $timeout, $rootScope, MessagingService,  $confirm, notify, ngDialog) {
    $scope.dateFormat = "yyyy-mm-dd"
    $scope.timeFormat = "hh:mm a"
    $scope.operation = data.operation
    $scope.visitorFormCustomDataModel = {}
    $scope.visitorFormModel ={}
    $scope.appointmentUpdateTemplate  = null
    $scope.templateRetrieved = false

    $scope.seatingModel = {}

    $scope.visitorCustomDataConfig = $rootScope.config.visitor_form
    
    if($scope.operation == 'add'){
        $scope.appointment = {
            job: null,
            roster: null,
            schduleItem: null,
            selectedVisitor: null,
            visitorType : 0,
            timeSlot : null,
            noSelection: true
        }
    } else {
        if(data.visitAppointment){
            $log.debug("edit attendantRosterItem", data.visitAppointment)
            $scope.appointment = {
                job: angular.copy(data.visitAppointment.visitJob),
                visitorType : 1,
                selectedVisitor: null,
                roster: data.visitAppointment.attendantRosterItem.roster,
                schduleItem: data.visitAppointment.attendantRosterItem,
                timeSlot : null,
                noSelection: true
            }

            $scope.appointment.job.visitJobConfig = atob($scope.appointment.job.visitJobType.jobConfiguration);
            $scope.appointment.job.visitJobConfig = JSON.parse($scope.appointment.job.visitJobConfig)
        } else {
            $scope.appointment = {
                job: null,
                roster: null,
                schduleItem: null,
                visitorType : 0,
                selectedVisitor: null,
                timeSlot : null,
                noSelection: true
            }
        }
    }


    //$scope.appointment = data.appointment ? data.appointment : {}
    $scope.jobSelected = false
    $scope.scheduleItemSelected= false
    $scope.jobs = []
    $scope.visitShiftInstances = []
    $scope.appointmentFilterFormModel = {}

    $log.debug("data ",  data)
    $log.debug("appointment ",  $scope.appointment)

    $scope.filterJobs = function(searchTerm){
        
        var result = $filter('filter')($scope.jobs, {visitJob:{jobName:searchTerm}} );

        $log.debug("filterJobs ",  result)

        return result
    }

    $scope.resetForm = function(){
   
        $scope.appointment = {
            job: null,
            roster: null,
            schduleItem: null,
            noSelection: true,
            visitorType : $scope.operation == 'edit' ? 1 : 0,
            selectedVisitor: null,
            timeSlot : null,
        }

        $scope.templateRetrieved = true
        $scope.visitShiftInstances = []
        $scope.seatingModel = {}
        $log.debug("resetForm ")
    }

    $scope.selectJob = function(job){
        $log.debug("selectJob job", job)

        $scope.resetForm()
        $scope.appointment.job = angular.copy(job)

        if($scope.appointment.job.visitJobConfig != null){
            $scope.appointment.job.visitJobConfig = atob($scope.appointment.job.visitJob.visitJobType.jobConfiguration);
            $log.debug("selectJob visitJobConfig", $scope.appointment.job.visitJobConfig)
            $scope.appointment.job.visitJobConfig = JSON.parse($scope.appointment.job.visitJobConfig)
            $log.debug("selectJob visitJobConfig", $scope.appointment.job.visitJobConfig)

            $scope.appointment.job.visitJob.appoinementFilterFormConfig = $scope.appointment.job.visitJobConfig.appoinementFilterFormConfig
            $scope.appointment.job.visitJob.visitorFormConfig = $scope.appointment.job.visitJobConfig.visitorFormConfig

            if($scope.appointment.job.visitJobConfig.appointmentUpdateTemplate){
                $scope.appointmentUpdateTemplate = "/web/public/template/"+ $scope.appointment.job.visitJobConfig.appointmentUpdateTemplate.name
            }else{
                $scope.appointmentUpdateTemplate = null
            }   
            
            $scope.initAppoinmentFilterForm(true, $scope.appointment.job, "", "")

            if( $scope.operation=='edit' &&  $scope.visitorCustomDataConfig){
                $scope.visitorFormCustomDataModel = data.visitAppointment.visit.visitor.customData.dataJson


                //convert all json object to string in each key
                angular.forEach($scope.visitorFormCustomDataModel , function(value, key){
                    if(angular.isObject(value)){
                        value = JSON.stringify(value)
                        $scope.visitorFormCustomDataModel[key] = value
                    }
                })

                var scope = {
                    visitor: data.visitAppointment.visit.visitor,
                    modelDefinition: $scope.visitorCustomDataConfig.customFields,
                    customModel: $scope.visitorFormCustomDataModel,
                    defaultModel: $scope.visitorFormModel
                }

            
                eval($scope.visitorCustomDataConfig.onLoad)

                if($scope.appointment.job.visitJob.visitorFormConfig.onLoad){
                    eval($scope.appointment.job.visitJob.visitorFormConfig.onLoad)
                }
                
                $scope.visitorFormModel = scope.defaultModel
                $scope.visitorFormCustomDataModel = scope.customModel

                $log.debug("selectJob customDataModel", $scope.visitorFormCustomDataModel)
            }

            $scope.createTitleMapForJob($scope.appointment.job);
            $scope.initializeShiftDates()
            $scope.searchAppointments()
        }

        $scope.templateRetrieved = true
        
    }

    $scope.initAppoinmentFilterForm=function(initialize, job,  keyObject, valueObject){
       
        //set default values for non-choosable vales ex: date, date time, time
        if(initialize){
            if(job){
                if( job.visitJob.appoinementFilterFormConfig){
                    if( job.visitJob.appoinementFilterFormConfig.schema){
                        if( job.visitJob.appoinementFilterFormConfig.schema.properties){
                            var schemaProperties = job.visitJob.appoinementFilterFormConfig.schema.properties;
                            angular.forEach(schemaProperties, function(value, key) {
                                var fieldValue = "";
                                if(value){
                                    switch (value.field) {
                                        case 'date':
                                            fieldValue = $scope.operation == 'edit'?  $filter('stringToDate')(data.visitAppointment.visit.visitStart, $scope.dateFormat)
                                             : moment().format(String($scope.dateFormat).toUpperCase());
                                            break;
                                        case 'time':
                                            fieldValue = "";
                                            break;
                                        case 'dateTime':
                                            fieldValue = "";
                                            break;
                                        default:
                                    }
                                }

                                if(!$scope.appointmentFilterFormModel[key])
                                    $scope.appointmentFilterFormModel[key] = fieldValue;
                            });
                        }
                        
                        
                    }
                }
            }
        }

        if(keyObject.length > 0){
            $log.debug("initAppoinmentFilterForm keyObject ", keyObject)
            $log.debug("initAppoinmentFilterForm valueObject ", valueObject)
            $scope.appointmentFilterFormModel[keyObject] = valueObject;
        }

        $log.debug("initAppoinmentFilterForm ", $scope.appointmentFilterFormModel)
    }

    $scope.setSelectedVisitor = function(asyncSelectedVisitor) {
        if (asyncSelectedVisitor != '') {

            var visitor = $scope.asyncResult2.filter(function(emp) 
		        {
                    if(emp.fullName === asyncSelectedVisitor)
                        return emp;
                }) 

            $scope.appointment.selectedVisitor = angular.copy(visitor[0])
        }

        $log.debug("setSelectedVisitor asyncResult2", $scope.asyncResult2)
        $log.debug("setSelectedVisitor asyncSelectedVisitor", asyncSelectedVisitor)
        $log.debug("setSelectedVisitor selectedVisitor", $scope.appointment.selectedVisitor)
    }

    $scope.resetVisitor = function(){
        $scope.appointment.selectedVisitor = null
    }

    $scope.searchVisitorForUpdate = function(str, groupId) {
        return AdminService.searchVisitor(str, groupId).then(function(response) {
            //return $http.get($scope.$parent.API_PREFIX + 'user/1/10/?search=' + str + '&group_id=' + groupId).then(function(response) {
            if (response.status === 200 && response.data.statusCode == "SUCCESS") {
                $scope.asyncResult2 = response.data.returnValue.data
                if ($scope.asyncResult2.length > 0) {
                    // add full name
                    for (var i = 0; i < $scope.asyncResult2.length; i++) {
                        var fullname = $scope.asyncResult2[i].firstName + ' ' + $scope.asyncResult2[i].lastName
                        $scope.asyncResult2[i].fullName = fullname
                    }
                    return $scope.asyncResult2.map(function(item) {
                        return item
                    })
                } else {
                    $scope.asyncResult2 = null
                    $scope.resetVisitor()
                }
            } else {
                MessagingService.sendMessage(response.data.statusCode)
            }
        })
    }

    $scope.createTitleMapForJob= function(job){
        if(job.visitJob.appoinementFilterFormConfig){
            if(job.visitJob.appoinementFilterFormConfig.form){
                $scope.formItemSelect(job.visitJob.appoinementFilterFormConfig.form, job)
            }
        }
    }

    $scope.formItemSelect = function(items, job){
            angular.forEach(items, function(item){
                if(item.items){
                    $scope.formItemSelect(item.items, job)
                }else{
                    $log.debug("formItemSelect1");
                    if(item.options){
                    
                        var scope = {
                            visitShiftInstances : job.visitShiftInstances,
                            titleMap: null
                        }
    
                        if(item.options.initItem){
                            eval(item.options.initItem)
                        }
                        
                       // var array = $scope.populateTitleMap(item, job)
                       var array = scope.titleMap
                        $log.debug("formItemSelect array", array);

                        if(array){
                            if(array.length >0){
                                item.titleMap = array
                                $scope.appointmentFilterFormModel[item.key] = array[0].value
                            }

                            if(array.length > 1 && $scope.appointment.noSelection == true)
                                $scope.appointment.noSelection = false 
                        }
                    }
                    
                }
            });
    }
    
    $scope.filterJson = function(jsonObject, source){

        var jsonItems = []
       $log.debug("filterJson jsonObject", jsonObject)
   
       if(jsonObject.length > 0){
           if(source.filters){
    
               angular.forEach(jsonObject, function(item) {
                   for (var i=0; i < source.filters.length; i++){
       
                       if(source.filters instanceof Array){
                           var filter = source.filters[i];
       
                           if(filter.filterKey && filter.filterValue ){
                               if(filter.filterObject){
                                   if(item[filter.filterObject]){
                                       var obj2 = item[filter.filterObject]
                                       if(obj2[filter.filterKey]){
                                           $log.debug("filterJson item", item)
                                           if(obj2[filter.filterKey] === filter.filterValue){
                                              // object.splice(index, 1);  
                                              jsonItems.push(angular.copy(item))
                                           }
                                       }
                                   }
                               }else{
                                   if(item[filter.filterKey]){
                                       if(item[filter.filterKey] === filter.filterValue){
                                           //object.splice(index, 1); 
                                           jsonItems.push(angular.copy(item))
                                       }
                                   }
                               }
                           }
                       } 
                   }
               });
           }
       }
   
       return jsonItems;
   
   
     }

    //get selected field property from the scheema.
    //this is used to get scheema propeties from form. ex: get field type using form key
    $scope.scanScheemaForm = function(schema, field, keyValue){
        if(schema){
            if(schema.properties){
                var schemaProperties = schema.properties;
                if(schemaProperties[field]){
                    var fieldObject = schemaProperties[field]
                    if(fieldObject[keyValue]){
                        if(fieldObject[keyValue].length > 0){
                            return fieldObject[keyValue];
                        }
                    }
                }
            }
        }

        return "";
    }

    $scope.searchAppointments = function(){
        $log.debug("searchAppointments appointmentFilterFormModel", $scope.appointmentFilterFormModel);

        $scope.searchButtonSelected = true;
        //check form exist
        if($scope.appointment.job.visitJob.appoinementFilterFormConfig){
            if(!$scope.appointment.job.visitJob.appoinementFilterFormConfig.form){
                return
            }
            if(!$scope.appointment.job.visitJob.appoinementFilterFormConfig.schema){
                return
            }
        }else{
            return;
        }

        //check visitShiftInstances arrray exist
        if($scope.appointment.job.visitShiftInstances){
            if($scope.appointment.job.visitShiftInstances.length == 0)
                return
        }else{
            return;
        }

        var scope = {
            visitShiftInstances : $scope.appointment.job.visitShiftInstances,
            model : $scope.appointmentFilterFormModel,
            filteredInstances : null
        }

        
        eval($scope.appointment.job.visitJob.appoinementFilterFormConfig.onAppointmentSelection)

        $scope.visitShiftInstances = scope.filteredInstances

        $log.debug("searchAppointments visitShiftInstances", $scope.visitShiftInstances)
        
        $scope.appointment.schduleItem = null

        angular.forEach($scope.visitShiftInstances, function(visitShiftInstance) {

            if($scope.operation == 'add'){
                visitShiftInstance.selected = false
            }else{
                if(visitShiftInstance.rosterItemId === data.visitAppointment.attendantRosterItem.rosterItemId){
                    visitShiftInstance.selected = true
                    if(data.visitAppointment.customData != null){
                        if(data.visitAppointment.customData.customDataType == "APPOINTMENT_CUSTOM_DATA"){
                            visitShiftInstance.customData = data.visitAppointment.customData.dataJson
                        }
                    }
                    
                    $scope.appointment.schduleItem = visitShiftInstance

                    if(data.visitAppointment.attendantRosterItem.slotTime > 0){
                        if(visitShiftInstance.timeSlots){

                            angular.forEach(visitShiftInstance.timeSlots, function(obj){
                                if(obj.slotNumber === data.visitAppointment.slotIndex)
                                        obj.selected = true
                            })

                            $log.debug("searchAppointments timeSlots ", visitShiftInstance.timeSlots)
                 
                               
                        }
                        
                    }
                    
                }else{
                    visitShiftInstance.selected = false
                }
            }
            
        });

        $log.debug("searchAppointments schduleItem ", $scope.appointment.schduleItem)
    }

    $scope.selectSchduleItem = function(schduleItem){

        angular.forEach($scope.visitShiftInstances, function(visitShiftInstance){
            visitShiftInstance.selected = false;
        })
        schduleItem.selected = true
        $scope.appointment.schduleItem = schduleItem

        $log.debug("selectSchduleItem schduleItem", $scope.appointment.schduleItem)
    }

    $scope.cancel = function() {
        $uibModalInstance.dismiss('cancel')
    }

    $scope.prepareDataForSubmit = function(form){
        var proceed = false;
        if( $scope.appointment.visitorType == 0){
            if($scope.appointment.selectedVisitor != null){
                proceed = true
            }else{
                notify({
                    message: "No visitor selected",
                    position: "right",
                    classes: "alert alert-success left-align",
                    messageTemplate: "<div><strong>Check for your previous pass code first.</strong></div>",
                    duration: 4000,
                    scope: $scope
                })
            }
        }else if( $scope.appointment.visitorType == 1){
            $scope.$broadcast('schemaFormValidate');
            $log.debug("prepareDataForSubmit form", form != null)
            if(form != null){
                $log.debug("prepareDataForSubmit form valid", form.$valid)
                if(form.$valid){
                    proceed = true
                }   
            }
        }
        
        return proceed;
    }

    $scope.timeSlotSelect = function(visitShiftInstance, timeSlot){

        if(visitShiftInstance.slotOccupancy > timeSlot.bookings){
            if(visitShiftInstance){
                if(visitShiftInstance.timeSlots){
                    angular.forEach(visitShiftInstance.timeSlots, function(timeSlotObj){
                        timeSlotObj.selected = false
                    })
                }
            }
    
            $log.debug("timeSlotSelect visitShiftInstance", visitShiftInstance)
            $log.debug("timeSlotSelect timeSlot", timeSlot)
            $scope.appointment.timeSlot = timeSlot
            timeSlot.selected = true
        }
        
    }

    $scope.getSettings = function(jobConfig, settingKey, defaultValue){
        var val = defaultValue
            if(jobConfig.hasOwnProperty("settings")){
                if(jobConfig.settings.hasOwnProperty(settingKey)){
                    val = jobConfig.settings[settingKey]
                }
            }

        return val
    }

    //For Type4 visit types
    $scope.populateSeats = function(){
        $scope.seatingModel.categories = angular.copy($scope.appointment.schduleItem.seatStatics.categories)
        $log.debug("populateSeats seatingModel", $scope.seatingModel )
        if($scope.seatingModel.categories.length > 0){
            for(var i=0; i < $scope.seatingModel.categories.length ; i++){
                $scope.seatingModel.categories[i].seatOrder = []

                var categoryName = $scope.seatingModel.categories[i].key
                for(var j = 0 ; j < $scope.seatingModel.categories[i].capacity ; j++){
                    
                    var seatBooked = false;
                    var seatBookedByVisitor = false
                    if($scope.appointment.schduleItem.seatStatics.booked.hasOwnProperty(categoryName)){
                        if($scope.appointment.schduleItem.seatStatics.booked[categoryName].indexOf(j) !== -1) {
                            seatBooked = true 
                        }

                        if($scope.appointment.schduleItem.hasOwnProperty("customData") && $scope.appointment.schduleItem.customData != null){
                            if($scope.appointment.schduleItem.customData[categoryName].indexOf(j) != -1){
                                seatBooked = false
                                seatBookedByVisitor = true
                            }
                        }
                    }

                    $scope.seatingModel.categories[i].seatOrder.push({booked: seatBooked, selected:seatBookedByVisitor, index:j})
                    
                }
            }
        }

        $log.debug("populateSeats seatingModel2", $scope.seatingModel )
    }

    // APIs
    $scope.submitAppointment = function(){
        var visit = null
        var visitorData = null
        var customModel = null
        var visitAppointment = {}

        if($scope.appointment.visitorType == 0){
            //Returning visitor
            $log.debug("submitAppointment selectedVisitor", $scope.appointment.selectedVisitor)
            visitorData = $scope.appointment.selectedVisitor

        }else if($scope.appointment.visitorType == 1){
            //New visitor
            if($scope.visitorCustomDataConfig){
                var scope = {
                    modelDefinition: $scope.visitorCustomDataConfig.customFields,
                    customModel: $scope.visitorFormCustomDataModel,
                    defaultModel: $scope.visitorFormModel
                }
    
                $log.debug("createNewVisitorAndVisit visitorData", scope)
                eval($scope.visitorCustomDataConfig.beforeSubmit)
    
                $log.debug("createNewVisitorAndVisit visitorData", scope)
                visitorData = scope.defaultModel
    
                //convert all json string to json object befoe submit
                angular.forEach(scope.customModel , function(value, key){
                    if(value.length > 0){
                        try {
                            value = JSON.parse(value);
                            scope.customModel[key] = value
                        } catch (e) {
                        }
                    }
                })
                customModel = JSON.stringify(scope.customModel)
            }

        }

         //add seat numbers if exist
         if($scope.seatingModel.hasOwnProperty("categories")){
            if($scope.seatingModel.categories.length > 0){
                
                var jsonObj = {}
                var seatString = ""
                var totPrice = 0
                for(var i=0; i < $scope.seatingModel.categories.length ; i++){
                    
                    jsonObj[$scope.seatingModel.categories[i].key]= []
                    if($scope.seatingModel.categories[i].seatOrder.length > 0){
                        angular.forEach($scope.seatingModel.categories[i].seatOrder, function(seat){
                            if(seat.selected){
                                jsonObj[$scope.seatingModel.categories[i].key].push(seat.index)
                                totPrice += $scope.seatingModel.categories[i].price
                                seatString += seatString.length==0 ? $scope.seatingModel.categories[i].key + ":" + seat.index : "," + $scope.seatingModel.categories[i].key + ":" + seat.index
                            }
                        })
                    }
                }
               // var jsonString = JSON.stringify(jsonObj)
                visitAppointment.customData = {dataJson: jsonObj, customDataType: "APPOINTMENT_CUSTOM_DATA"}
                $log.debug("submitAppointment json seating",  jsonObj)
                $log.debug("submitAppointment string seating",  seatString)
            }
        }


        var visit = {
            id: $scope.operation == 'add' ? null : data.visitAppointment.visit.id,
            visitor:  visitorData,
            visitCode: $scope.operation == 'add' ? null : data.visitAppointment.visit.visitCode,
            visitStart: moment($scope.appointment.schduleItem.shiftDate).format('YYYY-MM-DD HH:mm:ss'),
            visitEnd: moment($scope.appointment.schduleItem.shiftDate).format('YYYY-MM-DD HH:mm:ss'),
        }
      
        //Add/edit visit

        $log.debug("submitAppointment visit", visit)
        AdminService.updateVisit(visit).then(function(response) {
            if (response.status === 200 && response.data.statusCode == 'SUCCESS') {
               if(response.data.returnValue) {

                    
                    visitAppointment.id = $scope.operation == "edit" ? data.visitAppointment.id : null;
                    visitAppointment.visitJob = {id: $scope.appointment.job.visitJob.id}
                    visitAppointment.visit = {id : response.data.returnValue.id}
                    visitAppointment.attendantRosterItem = {rosterItemId : $scope.appointment.schduleItem.rosterItemId}
                    visitAppointment.appointmentStart = response.data.returnValue.visitStart;
                    visitAppointment.appointmentEnd = response.data.returnValue.visitEnd;
                    visitAppointment.slotIndex = $scope.appointment.timeSlot != null ? $scope.appointment.timeSlot.slotNumber : 0;
                    visitAppointment.timeZone = new Date().getTimezoneOffset() * 60 * (-1)
                    visitAppointment.sequenceIndex =0
                    visitAppointment.completed = false
                    visitAppointment.canceled = false
                    //save custom data to the person
                    if(customModel != null)
                        $scope.setCustomFieldData(response.data.returnValue.visitor.personId, customModel)

                    //Add/edit appointment
                    AdminService.updateAppointment(visitAppointment).then(function (response) {
                        if (response.status === 200 && response.data.statusCode == "SUCCESS") {
                            $uibModalInstance.close( response.data.returnValue)
                        } else {
                            MessagingService.sendMessage(response.data.statusCode)
                        }
                    }, function (errResponse) {
                        UtilityService.showErrorModal(errResponse.data.error, errResponse.data.exception)
                    })
               }
            } else {
                if (response.data.statusCode) {
                    MessagingService.sendMessage(response.data.statusCode)
                } else {
                    UtilityService.showErrorModal('Failed.', 'An error occured while saving custom data.')
                }
            }
        }, function(errResponse) {
            if (errResponse.data) {
                UtilityService.showErrorModal(errResponse.data.error, errResponse.data.message)
            } else {
                UtilityService.showErrorModal($filter('i18n')('common.connection_failed'), $filter('i18n')('common.check_your_internet'))
            }
        })
    }

    $scope.setCustomFieldData = function(visitorId, data) {
        AdminService.setCustomFieldData(visitorId, data).then(function(response) {
            if (response.status === 200 && response.data.statusCode == 'SUCCESS') {
               
            } else {
                var msg  = "<div><strong>" + $filter('i18n')('common.send_custom_data_json') + "</strong></div>"
                if (response.data.statusCode) {
                    msg = "<div><strong>" + $filter('i18n')('common.send_custom_data_json', [response.data.statusCode]) + "</strong></div>"
                } 

                notify({
                    position: "right",
                    messageTemplate: msg,
                    templateUrl: $scope.template,
                    classes: "alert alert-success left-align",
                    duration: 4000,
                    scope: $scope
                })
            }
        }, function(errResponse) {
            if (errResponse.data) {
                UtilityService.showErrorModal(errResponse.data.error, errResponse.data.message)
            } else {
                UtilityService.showErrorModal($filter('i18n')('common.connection_failed'), $filter('i18n')('common.check_your_internet'))
            }
        })
    }

    $scope.searchJob = function(str){
        return AdminService.getvisitJobs(-1, 10, str).then(function(response) {
            if (response.status === 200 && response.data.statusCode == "SUCCESS") {
                $scope.asyncResult = response.data.returnValue.data
                $log.debug("searchJob ", response.data.returnValue.data)
                if ($scope.asyncResult.length > 0) {
                    return $scope.asyncResult.map(function(item) {
                        return item
                    })
                } else {
                    $scope.asyncResult = null
                }
            } else {
                MessagingService.sendMessage(response.data.statusCode)
            }
        })
    }

    $scope.getVisitJobs = function(from, to){
         AdminService.getvisitJobsView(-1, from, to, false).then(function(response) {
            if (response.status === 200 && response.data.statusCode == "SUCCESS") {
               
                $scope.jobs = response.data.returnValue;

                for(var i=0 ; i< $scope.jobs.length ; i++){
                    $scope.jobs[i].visitJob.visitJobType.jobConfiguration = atob($scope.jobs[i].visitJob.visitJobType.jobConfiguration);
                    $scope.jobs[i].visitJob.visitJobType.jobConfiguration = JSON.parse($scope.jobs[i].visitJob.visitJobType.jobConfiguration)
                }

                $log.debug("getVisitJobs jobs", $scope.job)

                if($scope.operation == 'add'){
                    if($scope.jobs.length > 0){
                        $scope.selectJobFromList($scope.jobs[0])
                    }
                }else{
                    var job = $scope.jobs.find(x => x.visitJob.id === data.visitAppointment.visitJob.id);

                    $log.debug("getVisitJobs editJob", job)

                    $scope.selectJobFromList(job)
                }
                
               
            } else {
                MessagingService.sendMessage(response.data.statusCode)
            }
        })
    }

    $scope.selectJobFromList = function(job){

        var numOfDays = $scope.getSettings(job.visitJob.visitJobType.jobConfiguration, "calendarDays", 1 );

        var startDate =null
        var endDate = null

        if(data.operation == 'edit'){
            if(moment(data.visitAppointment.visit.visitStart).isSameOrAfter(new Date(), 'day')){
                startDate = $filter('stringToDate')(moment().format(String($scope.dateFormat).toUpperCase()), $scope.dateFormat)     
                endDate = $filter('stringToDate')(moment().add(numOfDays, 'days'), $scope.dateFormat)
            }else{
                startDate = $filter('stringToDate')(data.visitAppointment.visit.visitStart, $scope.dateFormat)  
                endDate = $filter('stringToDate')(moment(data.visitAppointment.visit.visitStart).add(numOfDays, 'days'), $scope.dateFormat)
            }
        }else{
            startDate = moment().format(String($scope.dateFormat).toUpperCase())
            endDate = $filter('stringToDate')(moment().add(numOfDays, 'days'), $scope.dateFormat)
        }

        AdminService.getvisitJobsView(job.visitJob.id, startDate, endDate, true).then(function(response) {
            if (response.status === 200 && response.data.statusCode == "SUCCESS") {

                if(response.data.returnValue.length == 1){
                    $scope.selectJob(response.data.returnValue[0])
                }

            }

        }, function(errResponse) {
            $log.error($filter('i18n')('common.check_your_internet'))
        })

    }

    
    //For Type4 visit types
    $scope.countAvailableSeats = function(visitShiftInstance){
        visitShiftInstance.seatStatics = {booked: {}, categories:[]}
        // if(visitShiftInstance.hasOwnProperty("customData") && visitShiftInstance.customData !=null){
        //     visitShiftInstance.seatStatics.booked = visitShiftInstance.customData
        // }

        if(visitShiftInstance.appointmentCustomdata.length > 0){
            angular.forEach(visitShiftInstance.appointmentCustomdata, function(customData){
                if(customData.customDataType === "APPOINTMENT_CUSTOM_DATA"){
                    angular.forEach(customData.dataJson, function(value, key){
                        if(visitShiftInstance.seatStatics.booked.hasOwnProperty(key)){
                            angular.forEach(value, function(val){
                                visitShiftInstance.seatStatics.booked[key].push(val);
                            })
                        }else{
                            visitShiftInstance.seatStatics.booked[key] = angular.copy(value)
                        }
                    })
                }
            })
        }
       

        AdminService.getTemplateData($scope.appointment.job.visitJob.visitJobType.code, "ROSTER_ITEM", visitShiftInstance.rosterItemId).then(function(response){
            if (response.status === 200 && response.data.statusCode == "SUCCESS") {

                if(response.data.returnValue != null){
                    var decoded = atob(response.data.returnValue)
                    var jsonObj = JSON.parse(decoded)
                    visitShiftInstance.seatStatics.categories = jsonObj.categories

                    for(var i=0; i < visitShiftInstance.seatStatics.categories.length ; i++){
                        visitShiftInstance.seatStatics.categories[i].key = visitShiftInstance.seatStatics.categories[i].name.replace(/[\s]/g, '');
                    }
                }

            }

            $log.debug("countAvailableSeats visitShiftInstance.seatStatics ", visitShiftInstance.seatStatics )
            $log.debug("countAvailableSeats visitShiftInstance ", visitShiftInstance )

        },  function(errResponse) {
            $scope.existingVisitor = null
            $log.error($filter('i18n')('common.check_your_internet'))
        })

       
    }
    

    $scope.getVisitJobs("", "")

    $scope.openCalendar = function(modelKey, executeSearch){

        var maxDate = null;
        $scope.modelKey = null
        $scope.executeSearch = executeSearch

        $log.debug('openCalendar executeSearch', $scope.executeSearch)

        if(modelKey){
            $scope.modelKey = modelKey
            var dateStr = $scope.appointmentFilterFormModel[modelKey]
            $scope.dt =  moment(dateStr, String($scope.dateFormat).toUpperCase() ).toDate();
            
        }else{
            $scope.dt = new Date()
        }

        var numOfDays = $scope.getSettings($scope.appointment.job.visitJobConfig, "calendarDays", 1 );
        $log.debug("openCalendar numOfDays", numOfDays)
        maxDate = moment(new Date()).add(numOfDays, 'days').toDate();

        $scope.dateOptions = {
            customClass: function(data){
                    var date = data.date
                    var mode = data.mode;
                    if (mode === 'day') {
                        var strDate = $filter('stringToDate')(date, $scope.dateFormat) 
                        if($scope.shfitDates.indexOf(strDate) != -1){
                        return 'date-available'
                        }
                    }
                    return ''
            },
            minDate: new Date(),
            maxDate: maxDate != null ? maxDate: "",
            dateDisabled: function(data) {
                var date = data.date
                var  mode = data.mode
                return mode === 'day' && !$scope.IsDateAvailable(date);
              },
            showWeeks: true
        };
               
        $scope.dialog = ngDialog.open({
            templateUrl: $rootScope.modePrefix+'/common/app/html/pages/visitRequestNew/modal/calendar-modal.html',
            className: 'ngdialog-theme-default',
            scope: $scope,
            showClose: false,
            closeByDocument: true
        })
    }

    $scope.closeCalendar = function(date) {

        $scope.appointmentFilterFormModel[$scope.modelKey] = moment(date).format(String($scope.dateFormat).toUpperCase())
        $scope.modelKey = null
        if($scope.dialog){
            $scope.dialog.close(1)
            $scope.dialog = null
        }

        $log.debug('closeCalendar executeSearch', $scope.executeSearch)
        if($scope.executeSearch){
            if( $scope.SearchTimeForm != null)
                    $scope.SearchTimeForm.$valid
            $scope.searchAppointments()
        }

    }

    $scope.selectToday = function(){
        $scope.dt = new Date()
    }



    $scope.IsDateAvailable = function(date){
        var strDate = $filter('stringToDate')(date, $scope.dateFormat) 
        if($scope.shfitDates.indexOf(strDate) == -1)
                return false;

        return true;
    }

    $scope.initializeShiftDates = function(){
        $scope.shfitDates = []
        if($scope.appointment.job){
            if($scope.appointment.job.visitShiftInstances){
                angular.forEach($scope.appointment.job.visitShiftInstances, function(visitShiftInstance){
                    var date =  $filter('stringToDate')(visitShiftInstance.shiftDate, $scope.dateFormat) 
                    if($scope.shfitDates.indexOf(date) == -1){
                        $scope.shfitDates.push(date)
                    }
                           
                })
            }
        }
    }
}


App.controller('UpdateAppointmentController', UpdateAppointmentController)
UpdateAppointmentController.$inject = ['$scope', 'AdminService', '$uibModalInstance', '$log', 'data', '$filter', 'UtilityService', '$timeout', '$rootScope', 'MessagingService', '$confirm', 'notify', 'ngDialog']

function printTicketContoller($scope, AdminService, $uibModalInstance, $log, data, $filter, UtilityService, $timeout, $rootScope, MessagingService, $confirm, notify,  $ocLazyLoad){

    $scope.ticketTemplate = data.ticketTemplate
    $scope.ticketViewTemplate = data.ticketViewTemplate
    $scope.visitorPass = ""

    $scope.openFromControlPanel = true;
    $scope.ticketParam = {}
    $scope.ticketParam.job =  data.visitAppointment
    $scope.ticketParam.visitRequestResponse = data.visitAppointment
    $scope.ticketParam.scheduleItemCustomDataModel = {}

    $log.debug("data ", data)

    $scope.isOpenFromClient = false

    if(window.callbackObj){
        $scope.isOpenFromClient = true
    }
    
    $scope.cancel = function() {
        $uibModalInstance.dismiss('cancel')
    }

    $scope.downloadTicket = function(){
        $log.debug("printTicket")
        $ocLazyLoad.load('./app/js/pdfmake.min.js').then(function () {
            // on success
            $log.debug("printTicket successs")
            printPdf()
        }, function () {
            // on failure
            $log.debug("printTicket failed")
            alert("Failed to load PDF report exporting modules. \nExporting reports as PDF will not work. ")
        })
    }

   function printPdf(){
        var ticketView = document.getElementById('ticket_print')
        html2canvas(ticketView, {
            onrendered: function(canvas) {
                var data = canvas.toDataURL();
                var docDefinition = {
                    content: [{
                        image: data,
                        width: 500,
                    }]
                };
                pdfMake.createPdf(docDefinition).download();
            }
        });
    }

    $scope.printTicket = function(externalExeConfig){
        
        //if($scope.isOpenFromClient){
            if(externalExeConfig != null){

                var decoded = atob(externalExeConfig)
    
                $log.debug("printTicket decoded", decoded) 

                var externalExePrint = JSON.parse(decoded)
                $log.debug("printTicket externalExePrint", externalExePrint)

                if(externalExePrint.hasOwnProperty("params")){
                    if(externalExePrint.params.length > 0)

                    $log.debug("printTicket parameters", externalExePrint.params)
                    for(var k=0 ; k < externalExePrint.params.length  ; k++){

                        externalExePrint.params[k].value = $scope.jsonPropertyByPath($scope.ticketParam, externalExePrint.params[k].value)
                        $log.debug("printTicket parameters", externalExePrint.params[k])
                
                    }
                }

                $log.debug("printTicket externalExePrint", externalExePrint)   
                var stringData = JSON.stringify(externalExePrint)
                $log.debug("printTicket json string", stringData)   
                var externalExeEncoded = btoa(stringData)
                $log.debug("printTicket encoded", externalExeEncoded) 

                callbackObj.saveTicket(null, externalExeEncoded)

            }
       // }
    }
    
    $scope.jsonPropertyByPath = function(o, s) {
        s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
        s = s.replace(/^\./, '');           // strip a leading dot
        var a = s.split('.');
        for (var i = 0, n = a.length; i < n; ++i) {
            var k = a[i];
            if (k in o) {
                o = o[k];
            } else {
                return;
            }
        }
        return o;
    }
    
    $scope.getScheduleItemCustomdata = function(){
        AdminService.getTemplateData($scope.ticketParam.visitRequestResponse.visitJob.visitJobType.code, "ROSTER_ITEM",  $scope.ticketParam.visitRequestResponse.attendantRosterItem.rosterItemId).then(function(response){
            if (response.status === 200 && response.data.statusCode == "SUCCESS") {

                if(response.data.returnValue != null){
                    var decoded = atob(response.data.returnValue)

                    $log.debug("getScheduleItemCustomdata decoded", decoded)
                    $scope.ticketParam.scheduleItemCustomDataModel = JSON.parse(decoded)
                    $log.debug("getScheduleItemCustomdata scheduleItemCustomDataModel", $scope.ticketParam)
                    var totalAmount = 0
                    var seatString = ""
                    if($scope.ticketParam.scheduleItemCustomDataModel.categories.length > 0){

                        for(var i = 0 ; i < $scope.ticketParam.scheduleItemCustomDataModel.categories.length ; i++){
                            $scope.ticketParam.scheduleItemCustomDataModel.categories[i].key = $scope.ticketParam.scheduleItemCustomDataModel.categories[i].name.replace(/[\s]/g, '');

                            var category = $scope.ticketParam.scheduleItemCustomDataModel.categories[i]
                            if($scope.ticketParam.job.hasOwnProperty("customData") && $scope.ticketParam.job.customData != null){
                                if($scope.ticketParam.job.customData.customDataType == "APPOINTMENT_CUSTOM_DATA"){
                                    if($scope.ticketParam.job.customData.dataJson[category.key]){
                                        var seatArray = $scope.ticketParam.job.customData.dataJson[category.key]
                                        for(var j=0 ; j<seatArray.length; j++ ){
                                            seatString += seatString.length==0 ? category.key + ":" + seatArray[j] : "," + category.key + ":" + seatArray[j]
                                            totalAmount += category.price
                                        }
                                    }
                                }
                            }
                        }
                    }

                    $scope.ticketParam.seating = {totalAmount: totalAmount, seatString, seatString}

                    $log.debug("getScheduleItemCustomdata seating",  $scope.ticketParam.seating)
                }
            }
        },  function(errResponse) {
            $log.error($filter('i18n')('common.check_your_internet'))
        })
    }

    $scope.getVisitorPass= function(personID) {
        AdminService.getVisitorPass(personID).then(function(response) {
            //return $http.get($scope.$parent.API_PREFIX + 'user/1/10/?search=' + str + '&group_id=' + groupId).then(function(response) {
            if (response.status === 200 && response.data.statusCode == "SUCCESS") {
                if(response.data.returnValue)
                $scope.ticketParam.visitRequestResponse.passCode = response.data.returnValue.passCode
                $scope.getScheduleItemCustomdata()
            } else {
                MessagingService.sendMessage(response.data.statusCode)
            }
        }, function(errResponse) {
            $log.error($filter('i18n')('common.check_your_internet'))
        })
    }

    
    $scope.getVisitorPass($scope.ticketParam.visitRequestResponse.visit.visitor.personId)
}

App.controller('printTicketContoller', printTicketContoller)
printTicketContoller.$inject = ['$scope', 'AdminService', '$uibModalInstance', '$log', 'data', '$filter', 'UtilityService', '$timeout', '$rootScope', 'MessagingService',  '$confirm', 'notify', '$ocLazyLoad']


function UpdateVisitNote($scope, AdminService, $uibModalInstance, $log, data, $filter, UtilityService, $timeout, $rootScope, MessagingService, $confirm, notify){

    $scope.operation = data.operation
    $scope.template = data.template
    $scope.appointment = data.appointment
    $scope.appointment.visit.visitor.fullName = $scope.appointment.visit.visitor.firstName + " " + $scope.appointment.visit.visitor.lastName
    $log.debug("appointment ", $scope.appointment)
    $scope.UItemplate=''


    $scope.visitNoteFormCustomDataModel = {}
    $scope.fileToUpload=null
    $scope.previewData = []
    $scope.defaultVisitNoteFormConfig = {
        "formDescription":"Provide the patient consultation details for the pharmacy",
        "visitNoteForm":{
            "form":[
                {
                "type":"section",
                "htmlClass":"col-md-12 col-sm-12 col-xs-12 schema-form-fixed-height",
                "items":[
                    {
                        "key":"fullName",
                        "options":{
                            "sourceObject":"visit.visitor",
                            "propertyKey": "employeeCode"
                        }

                    }
                ]
                },{
                "type":"section",
                "htmlClass":"col-md-12 col-sm-12 col-xs-12",
                "items":[
                    {
                        "key":"note"
                    }
                ]
                },{
                "type":"section",
                "htmlClass":"col-md-12 col-sm-12 col-xs-12 text-center",
                "items":[
                    {
                        "type":"section",
                        "htmlClass":"btn-group",
                        "items":[
                            {
                                "type":"button",
                                "title":"Select Attachment",
                                "onClick": "selectAttachments('image')",
                                "style":"btn btn-primary btn-file btn-sm remove-focus",
                                "icon":"glyphicon glyphicon-open"
                            }
                        ]
                    },
                    {
                        "type":"section",
                        "htmlClass":"btn-group",
                        "items":[
                            {
                                "type":"button",
                                "title":"Capture Attachment",
                                "onClick": "captureImage()",
                                "style":"btn btn-warning btn-sm remove-focus",
                                "icon":"glyphicon glyphicon-camera"
                            }
                        ]
                    }
                ]
                }
            ],
            "schema":{
               "type":"object",
               "title":"Comment",
               "properties":{
                  "fullName":{
                     "title":"Patient name",
                     "type":"string"
                  },
                  "note":{
                     "title":"Note",
                     "type":"string",
                     "x-schema-form": {
                        "type": "textarea",
                     }
                  },
               },
               "required":[
                  "fullName"
               ]
            }
        },
        "attachments":{
            "maxAttachments": 3,
            "accept":"image/jpeg,image/png"
        },
        "VisitNoteViewConfig":{
            "attachments": "Attachments",
            "upload": "Upload image",
            "capture": "Capture image"
        }
        
     }

    //  $scope.appointment={
    //      "id":12,
    //      "appointment_end": "03-03-2021",
    //      "appointment_start": "03-03-2021",
    //      "visitor": {
    //         "firstName": "Kathrine",
    //         "lastName": "Dowd",
    //         "fullName": "Kathrine Dowd",
    //         "email": "",
    //         "telephoneNumber": "",
    //         "employeeCode": "dweW32"
    //     },
    //     "visit_job":{
    //         "jobDescription": "Chanelling a doctor",
    //         "jobName": "Chanelling a doctor",
    //     }

    //  }

     $scope.description = ""
     $scope.noteForm={
         form:{}, 
         schema:{}
        }
     $scope.VisitNoteViewConfig={}
     $scope.attachments = {
        maxAttachments: 5,
        accept:""
     }

     $scope.initializeForm = function(){
        if($scope.defaultVisitNoteFormConfig){
            if($scope.noteForm){
                if($scope.noteForm.form){
                    $log.debug("initializeForm form", $scope.noteForm.form)
                    $scope.bindFormData($scope.noteForm.form)
                 
                }
            }
        }

        $log.debug("initializeForm visitNoteFormCustomDataModel", $scope.visitNoteFormCustomDataModel)
    }

    $scope.bindFormData = function(itemObj){
        if(itemObj){
            angular.forEach(itemObj, function(item){
                if(item.items){
                    $scope.bindFormData(item.items)
                }else{
                    $log.debug("bindFormData item", item)
                    var fieldKey = null
                    if(item.key){
                        if(item.key instanceof Array){
                            fieldKey = item.key[0]
                        }else{
                            fieldKey = item.key
                        }
                    }
                    if(fieldKey != null){
                        
                        var fieldKey = item.key
                        if(item.options){
                            var sourceObject = null
                            var propertyKey = null
                            
                            if(item.options.sourceObject)
                                sourceObject = item.options.sourceObject

                            var source = $scope.getSource(sourceObject)

                            if(source != null){
                                if(item.options.propertyKey){
                                    propertyKey = item.options.propertyKey
                                    $scope.visitNoteFormCustomDataModel[propertyKey]  = source[propertyKey]
                                }
                            }
                            
                            $scope.visitNoteFormCustomDataModel[fieldKey] = source[fieldKey]
                                
                        }
                    }
                }
            })
        }
    }
    
     $scope.initializeVisitNote = function(json){
        if(json){
            //initialize form description
            if(json.formDescription){
                $scope.description = json.formDescription
            }

            //initialize visit note form, form and scheema
            if(json.visitNoteForm){
                if(json.visitNoteForm.form && json.visitNoteForm.schema){
                    $scope.noteForm={
                        form:json.visitNoteForm.form, 
                        schema: json.visitNoteForm.schema
                       }

                    $scope.initializeForm()
                }
            }

            //initialize visit note attachements
            if(json.attachments){
                if(json.attachments.maxAttachments)
                    $scope.attachments.maxAttachments = json.attachments.maxAttachments
                
                if(json.attachments.accept)
                    $scope.attachments.accept = json.attachments.accept

            }

            if(json.VisitNoteViewConfig){
                $scope.VisitNoteViewConfig = json.VisitNoteViewConfig

            }
        }
    }




    $scope.getVisitNoteCustomeViewValue = function(property, defaultValue){
    
        var val = defaultValue ;
        if($scope.VisitNoteViewConfig){
            angular.forEach($scope.VisitNoteViewConfig, function(value, key) {
                if(key === property){
                    if(value.length > 0)
                        val = value
                }
    
            });
        }
        return val;
    }


    $scope.getSource = function(sourceObject){
        var source = $scope.appointment
        if($scope.appointment){
            if(sourceObject){
                if(sourceObject.length > 0){
                    var arrayObject =  sourceObject.split(".")

                    for(var i = 0 ; i < arrayObject.length ; i++){
                        if(source[arrayObject[i]])
                            source = source[arrayObject[i]]
                    }
                }
            }
        }

        return source
    }

    $scope.selectAttachments = function(type){
        $log.debug("selectAttachments type", type)
        $timeout(function () { angular.element('input[name="selectFile"]').click(); }, 0)
    }

    $scope.fileChanged = function(event){
        $log.debug("fileSelected file", event.target.files)
        $log.debug("fileSelected file", $scope.attachments.maxAttachments)

        if(  $scope.previewData.length < $scope.attachments.maxAttachments ){
            angular.forEach(event.target.files, function(file){
                $scope.previewFile(file)
            })
        }else{
            notify({
                position: "right",
                messageTemplate: "<div><strong>" + $filter('i18n')('visits.max_attachments_allowed', [$scope.attachments.maxAttachments]) + "</strong></div>",
                templateUrl: $scope.UItemplate,
                classes: "alert alert-success left-align",
                duration: 4000,
                scope: $scope
            })
        }
        
    }

    $scope.captureImage = function(){
        $log.debug("captureImage")
    }

    $scope.previewFile = function(file){
        var reader = new FileReader();
        var obj = new FormData().append('file',file);			
        reader.onload=function(data){
            var src = data.target.result;
            var size = ((file.size/(1024*1024)) > 1)? (file.size/(1024*1024)) + ' mB' : (file.size/		1024)+' kB';
            $scope.$apply(function(){
                $scope.previewData.push({'image':src, modality:"none"});
            });		
            $log.debug("previewFile", $scope.previewData)	
        }
        reader.readAsDataURL(file);
    }

    $scope.removePreviewData = function(data){
        var index = $scope.previewData.indexOf(data);
        $scope.previewData.splice(index, 1);    
    }

    $scope.bindFaceImage = function(data){
        if(data.modality === 'face'){
            return 'data:image/jpeg;base64,' + data.image; 
        }
    }

    $scope.previewTitle = function(modality){
        var title= ""

        if(modality === "face"){
            title = "Face"
        }else if(modality === "Finger"){
            title = "Finger"
        }else{
            title = "Image"
        }

        return title
    }

    $scope.cancel = function() {
        $uibModalInstance.dismiss('cancel')
    }


    // APIs

    $scope.getVisitNoteTemplate = function(){

        if($scope.template){
            AdminService.getVisitNoteTemplate($scope.template.template).then(function(response){

                if (response.status === 200 && response.data.statusCode == "SUCCESS") {
    
                    if(response.data.returnValue != null){
                        template = JSON.parse(response.data.returnValue)

                        $log.debug("getVisitNoteTemplate template", template)
                        $scope.initializeVisitNote(template)

                        $scope.getTemplateData()
                    }
                }
    
            }, function (errResponse) {
                UtilityService.showErrorModal(errResponse.data.error, errResponse.data.exception)
            })
        }
        
    }

    $scope.getVisitNoteTemplate()
    
    $scope.submitNote = function(){

        if($scope.template){

            $scope.visitNoteFormCustomDataModel.images = $scope.previewData

            var jsonString = JSON.stringify($scope.visitNoteFormCustomDataModel)
            $log.debug("submitNote jsonString", jsonString)
            var encodedString = btoa(jsonString);
            $log.debug("submitNote encodedString", encodedString)

            AdminService.updateTemplateData($scope.template.template, "APPOINTMENT", $scope.appointment.id, encodedString).then(function(response){
                if (response.status === 200 && response.data.statusCode == "SUCCESS") {

                    notify({
                        position: "right",
                        messageTemplate: "<div><strong>" + $filter('i18n')('visits.note_added_successfully', [$scope.template.name]) + "</strong></div>",
                        templateUrl: $scope.UItemplate,
                        classes: "alert alert-success left-align",
                        duration: 4000,
                        scope: $scope
                    })

                    $scope.cancel()

                }
            }, function (errResponse) {
                UtilityService.showErrorModal(errResponse.data.error, errResponse.data.exception)
            })
        }
    }

    $scope.getTemplateData = function(){
        if($scope.template){
            AdminService.getTemplateData($scope.template.template, "APPOINTMENT", $scope.appointment.id).then(function(response){
                if (response.status === 200 && response.data.statusCode == "SUCCESS") {

                    if(response.data.returnValue != null){
                        var decoded = atob(response.data.returnValue)

                        $log.debug("getTemplateData decoded", decoded)
                        $scope.visitNoteFormCustomDataModel = JSON.parse(decoded)
                        $scope.previewData = $scope.visitNoteFormCustomDataModel.images
                    }
                }

            }, function (errResponse) {
                UtilityService.showErrorModal(errResponse.data.error, errResponse.data.exception)
            })

        }
    }
    

}

App.controller('UpdateVisitNote', UpdateVisitNote)
UpdateVisitNote.$inject = ['$scope', 'AdminService', '$uibModalInstance', '$log', 'data', '$filter', 'UtilityService', '$timeout', '$rootScope', 'MessagingService',  '$confirm', 'notify']

